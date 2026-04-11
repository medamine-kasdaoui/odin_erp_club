import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, Types } from 'mongoose';
import { firstValueFrom } from 'rxjs';
import { AuditService } from '../audit/audit.service';
import { Role } from '../common/enums/role.enum';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { User, UserDocument } from '../users/schemas/user.schema';
import {
  CreateLedgerEntryDto,
  CreateTransferDto,
  EditBudgetThresholdDto,
  FinanceAiInsightsDto,
  GenerateReportDto,
  ListLedgerEntriesDto,
  MarkPayrollPaidDto,
  PayTrancheDto,
  PayrollPeriodDto,
  ReconcileStatementsDto
} from './dto/finance.dto';
import { BudgetThreshold, BudgetThresholdDocument } from './schemas/budget-threshold.schema';
import { LedgerEntry, LedgerEntryDocument } from './schemas/ledger-entry.schema';
import { PayrollRun, PayrollRunDocument } from './schemas/payroll-run.schema';
import { ReportJob, ReportJobDocument } from './schemas/report-job.schema';
import { Transfer, TransferDocument } from './schemas/transfer.schema';
import { TreasuryAccount, TreasuryAccountDocument } from './schemas/treasury-account.schema';

@Injectable()
export class FinanceService {
  constructor(
    @InjectModel(LedgerEntry.name) private readonly ledgerModel: Model<LedgerEntryDocument>,
    @InjectModel(PayrollRun.name) private readonly payrollModel: Model<PayrollRunDocument>,
    @InjectModel(Transfer.name) private readonly transferModel: Model<TransferDocument>,
    @InjectModel(TreasuryAccount.name)
    private readonly treasuryAccountModel: Model<TreasuryAccountDocument>,
    @InjectModel(BudgetThreshold.name)
    private readonly budgetModel: Model<BudgetThresholdDocument>,
    @InjectModel(ReportJob.name) private readonly reportModel: Model<ReportJobDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    private readonly auditService: AuditService,
    private readonly configService: ConfigService,
    private readonly httpService: HttpService
  ) {}

  private resolveClubId(actor: AuthUser): string {
    if (actor.role === Role.ADMIN) {
      throw new ForbiddenException('Admin must act through scoped club users for finance');
    }

    if (!actor.clubId) {
      throw new ForbiddenException('Club scope required');
    }

    return actor.clubId;
  }

  async createLedgerEntry(actor: AuthUser, dto: CreateLedgerEntryDto) {
    const clubId = this.resolveClubId(actor);
    const entry = await this.ledgerModel.create({
      clubId: new Types.ObjectId(clubId),
      entryDate: new Date(dto.entryDate),
      type: dto.type,
      description: dto.description,
      amount: dto.amount,
      status: dto.status
    });

    await this.auditService.write({
      clubId,
      actorUserId: actor.sub,
      actionType: 'LEDGER_ENTRY_CREATED',
      entityType: 'LedgerEntry',
      entityId: entry.id,
      before: null,
      after: entry.toObject(),
      metadata: { amount: dto.amount }
    });

    return entry;
  }

  async listLedgerEntries(actor: AuthUser, query: ListLedgerEntriesDto) {
    const clubId = this.resolveClubId(actor);
    const filter: FilterQuery<LedgerEntryDocument> = { clubId: new Types.ObjectId(clubId) };
    if (query.type) {
      filter.type = query.type;
    }
    if (query.from || query.to) {
      filter.entryDate = {};
      if (query.from) {
        filter.entryDate.$gte = new Date(query.from);
      }
      if (query.to) {
        filter.entryDate.$lte = new Date(query.to);
      }
    }

    return this.ledgerModel.find(filter).sort({ entryDate: -1 }).lean();
  }

  async previewPayroll(actor: AuthUser, dto: PayrollPeriodDto) {
    const clubId = this.resolveClubId(actor);
    const employees = await this.userModel.find({
      clubId: new Types.ObjectId(clubId),
      status: 'ACTIVE'
    });

    const lines = employees.map((employee) => ({
      userId: employee.id,
      name: `${employee.firstName} ${employee.lastName}`,
      role: employee.role,
      gross: 1000
    }));

    const totalAmount = lines.reduce((acc, line) => acc + Number(line.gross), 0);

    return {
      clubId,
      periodStart: dto.periodStart,
      periodEnd: dto.periodEnd,
      lines,
      totalAmount
    };
  }

  async executePayroll(actor: AuthUser, dto: PayrollPeriodDto) {
    const preview = await this.previewPayroll(actor, dto);
    const clubId = this.resolveClubId(actor);

    const dailyCountLimit = Number(
      this.configService.get<string>('SENSITIVE_DAILY_LIMIT_COUNT', '10')
    );
    const dailyAmountLimit = Number(
      this.configService.get<string>('SENSITIVE_DAILY_LIMIT_AMOUNT', '10000000')
    );
    const perActionLimit = Number(
      this.configService.get<string>('SENSITIVE_PER_ACTION_AMOUNT_LIMIT', '5000000')
    );

    if (preview.totalAmount > perActionLimit) {
      throw new ForbiddenException('Payroll amount exceeds per-action limit');
    }

    const dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date();
    dayEnd.setHours(23, 59, 59, 999);
    const summary = await this.auditService.getDailySensitiveSummary(
      actor.sub,
      'PAYROLL_EXECUTED',
      dayStart,
      dayEnd
    );

    if (summary.count >= dailyCountLimit) {
      throw new ForbiddenException('Daily sensitive action count limit reached');
    }
    if (summary.totalAmount + preview.totalAmount > dailyAmountLimit) {
      throw new ForbiddenException('Daily sensitive amount limit reached');
    }

    const payroll = await this.payrollModel.create({
      clubId: new Types.ObjectId(clubId),
      periodStart: new Date(dto.periodStart),
      periodEnd: new Date(dto.periodEnd),
      totalAmount: preview.totalAmount,
      status: 'EXECUTED',
      lines: preview.lines
    });

    await this.auditService.write({
      clubId,
      actorUserId: actor.sub,
      actionType: 'PAYROLL_EXECUTED',
      entityType: 'PayrollRun',
      entityId: payroll.id,
      before: null,
      after: payroll.toObject(),
      metadata: { amount: payroll.totalAmount }
    });

    return payroll;
  }

  async markPayrollPaid(actor: AuthUser, dto: MarkPayrollPaidDto) {
    const clubId = this.resolveClubId(actor);
    const payroll = await this.payrollModel.findOne({
      _id: new Types.ObjectId(dto.payrollRunId),
      clubId: new Types.ObjectId(clubId)
    });

    if (!payroll) {
      throw new NotFoundException('Payroll run not found');
    }

    const before = payroll.toObject();
    payroll.status = 'PAID';
    await payroll.save();

    await this.auditService.write({
      clubId,
      actorUserId: actor.sub,
      actionType: 'PAYROLL_MARKED_PAID',
      entityType: 'PayrollRun',
      entityId: payroll.id,
      before,
      after: payroll.toObject(),
      metadata: { amount: payroll.totalAmount }
    });

    return payroll;
  }

  async createTransfer(actor: AuthUser, dto: CreateTransferDto) {
    const clubId = this.resolveClubId(actor);

    const trancheAmount = Math.round((dto.totalFee / dto.contractYears) * 100) / 100;
    const tranches = Array.from({ length: dto.contractYears }, (_, idx) => {
      const dueDate = new Date();
      dueDate.setFullYear(dueDate.getFullYear() + idx + 1);
      return { dueDate, amount: trancheAmount, status: 'PENDING' as const };
    });

    const transfer = await this.transferModel.create({
      clubId: new Types.ObjectId(clubId),
      playerName: dto.playerName,
      direction: dto.direction,
      totalFee: dto.totalFee,
      contractYears: dto.contractYears,
      tranches
    });

    await this.auditService.write({
      clubId,
      actorUserId: actor.sub,
      actionType: 'TRANSFER_CREATED',
      entityType: 'Transfer',
      entityId: transfer.id,
      before: null,
      after: transfer.toObject(),
      metadata: { amount: dto.totalFee }
    });

    return transfer;
  }

  async generateAmortizationSchedule(actor: AuthUser, transferId: string) {
    const clubId = this.resolveClubId(actor);
    const transfer = await this.transferModel.findOne({
      _id: new Types.ObjectId(transferId),
      clubId: new Types.ObjectId(clubId)
    });

    if (!transfer) {
      throw new NotFoundException('Transfer not found');
    }

    const annualCharge = transfer.totalFee / transfer.contractYears;
    return {
      transferId: transfer.id,
      playerName: transfer.playerName,
      annualCharge,
      schedule: transfer.tranches.map((tranche, idx) => ({
        year: idx + 1,
        dueDate: tranche.dueDate,
        amount: tranche.amount,
        status: tranche.status
      }))
    };
  }

  async listUpcomingTranches(actor: AuthUser) {
    const clubId = this.resolveClubId(actor);
    const transfers = await this.transferModel
      .find({ clubId: new Types.ObjectId(clubId), 'tranches.status': 'PENDING' })
      .lean();

    return transfers
      .flatMap((transfer) =>
        transfer.tranches
          .map((tranche, trancheIndex) => ({
            transferId: String(transfer._id),
            playerName: transfer.playerName,
            direction: transfer.direction,
            trancheIndex,
            dueDate: tranche.dueDate,
            amount: tranche.amount,
            status: tranche.status
          }))
          .filter((tranche) => tranche.status === 'PENDING')
      )
      .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
  }

  async payTranche(actor: AuthUser, dto: PayTrancheDto) {
    const clubId = this.resolveClubId(actor);
    const transfer = await this.transferModel.findOne({
      _id: new Types.ObjectId(dto.transferId),
      clubId: new Types.ObjectId(clubId)
    });

    if (!transfer) {
      throw new NotFoundException('Transfer not found');
    }

    if (!transfer.tranches[dto.trancheIndex]) {
      throw new BadRequestException('Invalid tranche index');
    }

    const tranche = transfer.tranches[dto.trancheIndex];
    if (tranche.status === 'PAID') {
      throw new BadRequestException('Tranche already paid');
    }

    if (dto.amount !== tranche.amount) {
      throw new BadRequestException('Amount mismatch for tranche payment');
    }

    const before = transfer.toObject();
    tranche.status = 'PAID';
    tranche.paidAt = new Date();
    await transfer.save();

    await this.auditService.write({
      clubId,
      actorUserId: actor.sub,
      actionType: 'TRANSFER_TRANCHE_PAID',
      entityType: 'Transfer',
      entityId: transfer.id,
      before,
      after: transfer.toObject(),
      metadata: { amount: dto.amount, trancheIndex: dto.trancheIndex }
    });

    return transfer;
  }

  async listTreasuryAccounts(actor: AuthUser) {
    const clubId = this.resolveClubId(actor);
    let accounts = await this.treasuryAccountModel
      .find({ clubId: new Types.ObjectId(clubId) })
      .lean();

    if (accounts.length === 0) {
      await this.treasuryAccountModel.create({
        clubId: new Types.ObjectId(clubId),
        name: 'Main Account',
        balance: 0,
        manual: true
      });
      accounts = await this.treasuryAccountModel
        .find({ clubId: new Types.ObjectId(clubId) })
        .lean();
    }

    return accounts;
  }

  async reconcileStatements(actor: AuthUser, dto: ReconcileStatementsDto) {
    const clubId = this.resolveClubId(actor);
    const now = new Date();

    const accounts = await this.treasuryAccountModel.find({ clubId: new Types.ObjectId(clubId) });
    const before = accounts.map((account) => account.toObject());

    for (const account of accounts) {
      account.lastReconciledAt = now;
      await account.save();
    }

    await this.auditService.write({
      clubId,
      actorUserId: actor.sub,
      actionType: 'TREASURY_RECONCILED',
      entityType: 'TreasuryAccount',
      entityId: 'ALL',
      before: { accounts: before },
      after: { accounts: accounts.map((account) => account.toObject()) },
      metadata: { amount: dto.amount, note: dto.note }
    });

    return { success: true, reconciledAt: now };
  }

  async getBudget(actor: AuthUser) {
    const clubId = this.resolveClubId(actor);
    let budget = await this.budgetModel.findOne({ clubId: new Types.ObjectId(clubId) });

    if (!budget) {
      budget = await this.budgetModel.create({
        clubId: new Types.ObjectId(clubId),
        items: [
          { category: 'Operations', threshold: 1000000, utilized: 0 },
          { category: 'Transfers', threshold: 1000000, utilized: 0 }
        ]
      });
    }

    return budget;
  }

  async editBudgetThresholds(actor: AuthUser, dto: EditBudgetThresholdDto) {
    const clubId = this.resolveClubId(actor);
    const budget = await this.getBudget(actor);

    const before = budget.toObject();
    budget.items = dto.items as typeof budget.items;
    await budget.save();

    await this.auditService.write({
      clubId,
      actorUserId: actor.sub,
      actionType: 'BUDGET_THRESHOLDS_EDITED',
      entityType: 'BudgetThreshold',
      entityId: budget.id,
      before,
      after: budget.toObject(),
      metadata: { amount: dto.amount }
    });

    return budget;
  }

  async generateReport(actor: AuthUser, dto: GenerateReportDto) {
    const clubId = this.resolveClubId(actor);
    const [ledgerCount, transferCount, payrollCount] = await Promise.all([
      this.ledgerModel.countDocuments({ clubId: new Types.ObjectId(clubId) }),
      this.transferModel.countDocuments({ clubId: new Types.ObjectId(clubId) }),
      this.payrollModel.countDocuments({ clubId: new Types.ObjectId(clubId) })
    ]);

    const payload = {
      type: dto.type,
      generatedAt: new Date().toISOString(),
      counts: { ledgerCount, transferCount, payrollCount }
    };

    const report = await this.reportModel.create({
      clubId: new Types.ObjectId(clubId),
      requestedByUserId: new Types.ObjectId(actor.sub),
      type: dto.type,
      status: 'DONE',
      fileContent: JSON.stringify(payload, null, 2)
    });

    await this.auditService.write({
      clubId,
      actorUserId: actor.sub,
      actionType: 'REPORT_GENERATED',
      entityType: 'ReportJob',
      entityId: report.id,
      before: null,
      after: report.toObject(),
      metadata: { type: dto.type }
    });

    return report;
  }

  async downloadReport(actor: AuthUser, reportId: string) {
    const clubId = this.resolveClubId(actor);
    const report = await this.reportModel.findOne({
      _id: new Types.ObjectId(reportId),
      clubId: new Types.ObjectId(clubId)
    });

    if (!report) {
      throw new NotFoundException('Report not found');
    }

    return {
      reportId: report.id,
      type: report.type,
      generatedAt: report.createdAt,
      content: report.fileContent
    };
  }

  async generateAiInsights(actor: AuthUser, dto: FinanceAiInsightsDto) {
    const start = Date.now();
    const clubId = this.resolveClubId(actor);

    const [budget, ledgerEntries, upcomingTranches, payrollRuns, transfers, treasuryAccounts] =
      await Promise.all([
        this.getBudget(actor),
        this.ledgerModel
          .find({ clubId: new Types.ObjectId(clubId), status: 'POSTED' })
          .sort({ entryDate: -1 })
          .lean(),
        this.listUpcomingTranches(actor),
        this.payrollModel
          .find({ clubId: new Types.ObjectId(clubId) })
          .sort({ createdAt: -1 })
          .lean(),
        this.transferModel.find({ clubId: new Types.ObjectId(clubId) }).lean(),
        this.treasuryAccountModel.find({ clubId: new Types.ObjectId(clubId) }).lean()
      ]);

    const clubPayload = {
      budgetItems: budget.items,
      focusCategories: dto.focusCategories ?? [],
      ledgerEntries: ledgerEntries.map((entry) => ({
        entryDate: entry.entryDate,
        type: entry.type,
        description: entry.description,
        amount: entry.amount,
        status: entry.status
      })),
      upcomingTranches: upcomingTranches.map((tranche) => ({
        dueDate: tranche.dueDate,
        amount: tranche.amount,
        direction: tranche.direction
      })),
      payrollRuns: payrollRuns.map((payroll) => ({
        periodStart: payroll.periodStart,
        periodEnd: payroll.periodEnd,
        totalAmount: payroll.totalAmount,
        status: payroll.status
      })),
      transfers: transfers.map((transfer) => ({
        direction: transfer.direction,
        totalFee: transfer.totalFee,
        contractYears: transfer.contractYears,
        tranches: transfer.tranches?.map((tranche) => ({
          dueDate: tranche.dueDate,
          amount: tranche.amount,
          status: tranche.status
        }))
      })),
      treasuryAccounts: treasuryAccounts.map((account) => ({
        name: account.name,
        balance: account.balance,
        manual: account.manual,
        lastReconciledAt: account.lastReconciledAt
      }))
    };

    const financeAiUrl =
      this.configService.get<string>('FINANCE_AI_URL') || 'http://localhost:8200';

    try {
      const history = this.buildMonthlyHistory(clubPayload.ledgerEntries);
      const horizon = dto.horizon && dto.horizon > 0 ? dto.horizon : 12;

      const forecastResponse = await firstValueFrom(
        this.httpService.post(
          `${financeAiUrl}/forecast`,
          { data: history.length ? history : undefined, horizon },
          { timeout: 12000 }
        )
      );
      const riskResponse = await firstValueFrom(
        this.httpService.post(
          `${financeAiUrl}/risk`,
          { data: history.length ? history : undefined, horizon },
          { timeout: 12000 }
        )
      );

      const sponsorPct = dto.sponsorPct ?? 10;
      const transferDelta = dto.transferDelta ?? 0;

      const simulateBase = await firstValueFrom(
        this.httpService.post(
          `${financeAiUrl}/simulate`,
          { data: history.length ? history : undefined, horizon, sponsor_pct: 0, transfer_delta: transferDelta },
          { timeout: 12000 }
        )
      );
      const simulatePlus = await firstValueFrom(
        this.httpService.post(
          `${financeAiUrl}/simulate`,
          { data: history.length ? history : undefined, horizon, sponsor_pct: sponsorPct, transfer_delta: transferDelta },
          { timeout: 12000 }
        )
      );
      const simulateMinus = await firstValueFrom(
        this.httpService.post(
          `${financeAiUrl}/simulate`,
          { data: history.length ? history : undefined, horizon, sponsor_pct: -Math.abs(sponsorPct), transfer_delta: transferDelta },
          { timeout: 12000 }
        )
      );

      const forecastPayload = forecastResponse?.data ?? {};
      const riskPayload = riskResponse?.data ?? {};
      const baseSim = simulateBase?.data ?? {};
      const plusSim = simulatePlus?.data ?? {};
      const minusSim = simulateMinus?.data ?? {};

      const forecastSummary = this.buildForecastSummaryFromMl(
        forecastPayload?.forecast ?? []
      );
      const cashflowRisk = this.buildCashflowRiskFromMl(
        forecastPayload?.forecast ?? [],
        riskPayload?.risk_alerts ?? [],
        treasuryAccounts
      );
      const sponsorTransferImpact = this.buildSponsorTransferImpactFromMl(
        baseSim?.simulation_result ?? [],
        plusSim?.simulation_result ?? [],
        minusSim?.simulation_result ?? [],
        transfers
      );

      const fallback = this.buildFallbackInsights({
        budgetItems: clubPayload.budgetItems,
        focusCategories: clubPayload.focusCategories,
        ledgerEntries: clubPayload.ledgerEntries,
        upcomingTranches: clubPayload.upcomingTranches,
        payrollRuns: clubPayload.payrollRuns
      });

      return {
        source: 'finance-ml',
        generatedAt: new Date().toISOString(),
        generationTimeMs: Date.now() - start,
        dataPoints: {
          ledgerEntries: ledgerEntries.length,
          payrollRuns: payrollRuns.length,
          transfers: transfers.length,
          treasuryAccounts: treasuryAccounts.length
        },
        forecast: forecastSummary,
        cashflowRisk,
        sponsorTransferImpact,
        ...fallback
      };
    } catch (error) {
      const analytics = this.buildFinanceAiAnalytics(clubPayload);
      const fallback = this.buildFallbackInsights({
        budgetItems: clubPayload.budgetItems,
        focusCategories: clubPayload.focusCategories,
        ledgerEntries: clubPayload.ledgerEntries,
        upcomingTranches: clubPayload.upcomingTranches,
        payrollRuns: clubPayload.payrollRuns
      });

      return {
        source: 'analytics-local',
        generatedAt: new Date().toISOString(),
        generationTimeMs: Date.now() - start,
        reason:
          error instanceof Error
            ? `Finance AI unavailable: ${error.message}`
            : 'Finance AI unavailable',
        dataPoints: {
          ledgerEntries: ledgerEntries.length,
          payrollRuns: payrollRuns.length,
          transfers: transfers.length,
          treasuryAccounts: treasuryAccounts.length
        },
        ...analytics,
        ...fallback
      };
    }
  }

  private buildMonthlyHistory(
    ledgerEntries: Array<{
      entryDate: Date;
      type: string;
      description: string;
      amount: number;
      status: string;
    }>
  ) {
    const buckets = new Map<string, { date: string; revenue: number; expenses: number }>();

    for (const entry of ledgerEntries) {
      const date = new Date(entry.entryDate);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`;
      const bucket = buckets.get(key) || { date: key, revenue: 0, expenses: 0 };
      const amount = Math.abs(Number(entry.amount || 0));
      const isExpense = this.isExpenseEntry(entry.type, entry.description, entry.amount);
      if (isExpense) {
        bucket.expenses += amount;
      } else {
        bucket.revenue += amount;
      }
      buckets.set(key, bucket);
    }

    return [...buckets.values()].sort((a, b) => a.date.localeCompare(b.date));
  }

  private buildForecastSummaryFromMl(forecast: Array<Record<string, any>>) {
    if (!forecast.length) {
      return {
        bySeason: [],
        nextSeason: { season: 'N/A', revenue: 0, expense: 0, net: 0 },
        confidence: 50
      };
    }

    const seasonKey = (date: Date) => {
      const month = date.getMonth() + 1;
      const startYear = month >= 7 ? date.getFullYear() : date.getFullYear() - 1;
      return `${startYear}/${startYear + 1}`;
    };

    const seasonBuckets = new Map<
      string,
      { revenue: number; expense: number; net: number; entryCount: number }
    >();

    for (const row of forecast) {
      const date = new Date(row.date);
      const key = seasonKey(date);
      const bucket =
        seasonBuckets.get(key) || { revenue: 0, expense: 0, net: 0, entryCount: 0 };
      const revenue = Number(row.revenue || 0);
      const expense = Number(row.expenses || 0);
      bucket.revenue += revenue;
      bucket.expense += expense;
      bucket.net += revenue - expense;
      bucket.entryCount += 1;
      seasonBuckets.set(key, bucket);
    }

    const bySeason = [...seasonBuckets.entries()].map(([season, bucket]) => ({
      season,
      revenue: Math.round(bucket.revenue),
      expense: Math.round(bucket.expense),
      net: Math.round(bucket.net),
      entries: bucket.entryCount
    }));

    const nextSeason = bySeason[0] ?? {
      season: 'N/A',
      revenue: 0,
      expense: 0,
      net: 0
    };

    const intervals = forecast
      .map((row) => {
        const upper = Number(row.revenue_upper || 0);
        const lower = Number(row.revenue_lower || 0);
        const base = Math.max(1, Number(row.revenue || 0));
        return Math.abs(upper - lower) / base;
      })
      .filter((value) => Number.isFinite(value));
    const avgUncertainty =
      intervals.length > 0
        ? intervals.reduce((sum, v) => sum + v, 0) / intervals.length
        : 0.3;
    const confidence = Math.max(50, Math.round(100 - avgUncertainty * 100));

    return { bySeason, nextSeason, confidence };
  }

  private buildCashflowRiskFromMl(
    forecast: Array<Record<string, any>>,
    riskAlerts: Array<Record<string, any>>,
    treasuryAccounts: Array<{ balance: number }>
  ) {
    const severityRank = { low: 1, medium: 2, high: 3 };
    const highest = riskAlerts.reduce(
      (acc, alert) => {
        const key = String(alert.severity || 'low').toLowerCase();
        return severityRank[key as keyof typeof severityRank] > acc.rank
          ? { rank: severityRank[key as keyof typeof severityRank], level: key }
          : acc;
      },
      { rank: 0, level: 'low' }
    );

    const treasuryBalance = treasuryAccounts.reduce(
      (sum, account) => sum + Number(account.balance || 0),
      0
    );

    const nextThree = forecast.slice(0, 3);
    const inflows = nextThree.reduce((sum, row) => sum + Number(row.revenue || 0), 0);
    const outflows = nextThree.reduce((sum, row) => sum + Number(row.expenses || 0), 0);
    const projectedCash = treasuryBalance + inflows - outflows;

    const score = highest.level === 'high' ? 85 : highest.level === 'medium' ? 60 : 30;
    const notes = riskAlerts.slice(0, 3).map((alert) => alert.explanation || '');

    return {
      horizonDays: 90,
      treasuryBalance: Math.round(treasuryBalance),
      projectedCash: Math.round(projectedCash),
      upcomingOutflows: Math.round(outflows),
      upcomingInflows: Math.round(inflows),
      monthlyNet:
        nextThree.length > 0
          ? Math.round((inflows - outflows) / nextThree.length)
          : 0,
      level: highest.level.toUpperCase(),
      score,
      notes
    };
  }

  private buildSponsorTransferImpactFromMl(
    baseSim: Array<Record<string, any>>,
    plusSim: Array<Record<string, any>>,
    minusSim: Array<Record<string, any>>,
    transfers: Array<{ direction: string; totalFee: number }>
  ) {
    const sumNet = (rows: Array<Record<string, any>>) =>
      rows.reduce((sum, row) => sum + Number(row.net || 0), 0);

    const baseNet = sumNet(baseSim);
    const plusNet = sumNet(plusSim);
    const minusNet = sumNet(minusSim);

    const transferOut = transfers
      .filter((t) => t.direction === 'ACQUISITION')
      .reduce((sum, t) => sum + Number(t.totalFee || 0), 0);
    const transferIn = transfers
      .filter((t) => t.direction === 'TRANSFER')
      .reduce((sum, t) => sum + Number(t.totalFee || 0), 0);
    const transferNet = transferIn - transferOut;

    return {
      sponsorBase: Math.round(baseNet),
      sponsorPlus10: Math.round(baseNet + (plusNet - baseNet)),
      sponsorMinus10: Math.round(baseNet + (minusNet - baseNet)),
      transferNet: Math.round(transferNet),
      scenario: {
        sponsorImpactPlus10: Math.round(plusNet - baseNet),
        sponsorImpactMinus10: Math.round(minusNet - baseNet),
        transferNet: Math.round(transferNet)
      }
    };
  }

  private isExpenseEntry(type: string, description: string, amount: number) {
    const upper = `${type} ${description}`.toUpperCase();
    const expenseKeywords = [
      'EXPENSE',
      'DEPENSE',
      'PAYROLL',
      'SALARY',
      'CHARGE',
      'FEE',
      'ACQUISITION',
      'TRANSFER OUT'
    ];
    if (amount < 0) return true;
    return expenseKeywords.some((keyword) => upper.includes(keyword));
  }

  private buildFinanceAiAnalytics(payload: {
    budgetItems: Array<{ category: string; threshold: number; utilized: number }>;
    focusCategories: string[];
    ledgerEntries: Array<{
      entryDate: Date;
      type: string;
      description: string;
      amount: number;
      status: string;
    }>;
    upcomingTranches: Array<{ dueDate: Date; amount: number; direction: string }>;
    payrollRuns: Array<{
      periodStart: Date;
      periodEnd: Date;
      totalAmount: number;
      status: string;
    }>;
    transfers: Array<{
      direction: string;
      totalFee: number;
      contractYears: number;
      tranches?: Array<{ dueDate: Date; amount: number; status: string }>;
    }>;
    treasuryAccounts: Array<{ name: string; balance: number; manual: boolean }>;
  }) {
    const classifyExpense = (type: string, description: string, amount: number) => {
      const upper = `${type} ${description}`.toUpperCase();
      const expenseKeywords = [
        'EXPENSE',
        'DEPENSE',
        'PAYROLL',
        'SALARY',
        'CHARGE',
        'FEE',
        'ACQUISITION',
        'TRANSFER OUT'
      ];
      if (amount < 0) return true;
      return expenseKeywords.some((keyword) => upper.includes(keyword));
    };

    const seasonKey = (date: Date) => {
      const d = new Date(date);
      const year = d.getFullYear();
      const month = d.getMonth() + 1;
      const startYear = month >= 7 ? year : year - 1;
      return `${startYear}/${startYear + 1}`;
    };

    const seasonBuckets = new Map<
      string,
      { revenue: number; expense: number; entryCount: number }
    >();

    for (const entry of payload.ledgerEntries) {
      const key = seasonKey(entry.entryDate);
      const bucket = seasonBuckets.get(key) || { revenue: 0, expense: 0, entryCount: 0 };
      const amount = Math.abs(Number(entry.amount || 0));
      const isExpense = classifyExpense(entry.type, entry.description, entry.amount);
      if (isExpense) {
        bucket.expense += amount;
      } else {
        bucket.revenue += amount;
      }
      bucket.entryCount += 1;
      seasonBuckets.set(key, bucket);
    }

    const seasons = [...seasonBuckets.entries()]
      .map(([season, values]) => {
        const startYear = Number(season.split('/')[0]);
        return { season, startYear, ...values, net: values.revenue - values.expense };
      })
      .sort((a, b) => a.startYear - b.startYear);

    const linearForecast = (series: number[]) => {
      const n = series.length;
      if (n === 0) return 0;
      if (n === 1) return series[0];
      const xs = series.map((_, idx) => idx);
      const sumX = xs.reduce((s, v) => s + v, 0);
      const sumY = series.reduce((s, v) => s + v, 0);
      const sumXY = xs.reduce((s, v, i) => s + v * series[i], 0);
      const sumX2 = xs.reduce((s, v) => s + v * v, 0);
      const denominator = n * sumX2 - sumX * sumX;
      const slope = denominator === 0 ? 0 : (n * sumXY - sumX * sumY) / denominator;
      const intercept = sumY / n - slope * (sumX / n);
      return intercept + slope * n;
    };

    const revenueSeries = seasons.map((s) => s.revenue);
    const expenseSeries = seasons.map((s) => s.expense);
    const forecastRevenue = linearForecast(revenueSeries);
    const forecastExpense = linearForecast(expenseSeries);
    const lastSeasonStart = seasons.length
      ? seasons[seasons.length - 1].startYear
      : new Date().getFullYear();
    const nextSeason = `${lastSeasonStart + 1}/${lastSeasonStart + 2}`;

    const confidence = Math.min(0.92, 0.4 + seasons.length * 0.15);

    const forecast = {
      bySeason: seasons.map((s) => ({
        season: s.season,
        revenue: Math.round(s.revenue),
        expense: Math.round(s.expense),
        net: Math.round(s.net),
        entries: s.entryCount
      })),
      nextSeason: {
        season: nextSeason,
        revenue: Math.max(0, Math.round(forecastRevenue)),
        expense: Math.max(0, Math.round(forecastExpense)),
        net: Math.round(forecastRevenue - forecastExpense)
      },
      confidence: Math.round(confidence * 100)
    };

    const treasuryBalance = payload.treasuryAccounts.reduce(
      (sum, account) => sum + Number(account.balance || 0),
      0
    );

    const now = new Date();
    const horizonDays = 90;
    const horizonLimit = new Date(now.getTime() + horizonDays * 24 * 60 * 60 * 1000);
    const upcomingTransfers = payload.upcomingTranches.filter(
      (tranche) => new Date(tranche.dueDate) <= horizonLimit
    );

    const upcomingOutflows = upcomingTransfers.reduce((sum, tranche) => {
      return tranche.direction === 'ACQUISITION' ? sum + Number(tranche.amount || 0) : sum;
    }, 0);

    const upcomingInflows = upcomingTransfers.reduce((sum, tranche) => {
      return tranche.direction === 'TRANSFER' ? sum + Number(tranche.amount || 0) : sum;
    }, 0);

    const recentPayrollRuns = payload.payrollRuns.slice(0, 3);
    const avgPayroll =
      recentPayrollRuns.length === 0
        ? 0
        : recentPayrollRuns.reduce((sum, run) => sum + Number(run.totalAmount || 0), 0) /
          recentPayrollRuns.length;
    const payrollForecast = avgPayroll * 3;

    const recentLedger = payload.ledgerEntries.slice(0, 24);
    const monthlyNet =
      recentLedger.length === 0
        ? 0
        : recentLedger.reduce((sum, entry) => {
            const amount = Math.abs(Number(entry.amount || 0));
            const isExpense = classifyExpense(entry.type, entry.description, entry.amount);
            return sum + (isExpense ? -amount : amount);
          }, 0) / 6;

    const projectedCash =
      treasuryBalance + upcomingInflows - upcomingOutflows - payrollForecast + monthlyNet * 3;
    const cashCoverage = upcomingOutflows <= 0 ? 2 : projectedCash / upcomingOutflows;

    let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW';
    let riskScore = 20;
    if (projectedCash < 0 || cashCoverage < 0.5) {
      riskLevel = 'HIGH';
      riskScore = 85;
    } else if (cashCoverage < 1.2) {
      riskLevel = 'MEDIUM';
      riskScore = 55;
    }

    const cashflowRisk = {
      horizonDays,
      treasuryBalance: Math.round(treasuryBalance),
      projectedCash: Math.round(projectedCash),
      upcomingOutflows: Math.round(upcomingOutflows + payrollForecast),
      upcomingInflows: Math.round(upcomingInflows),
      monthlyNet: Math.round(monthlyNet),
      level: riskLevel,
      score: riskScore,
      notes: [
        `Couverture cash estimée: ${cashCoverage.toFixed(2)}x`,
        `Masse salariale projetée (90j): ${Math.round(payrollForecast)}`,
        `Flux net mensuel récent: ${Math.round(monthlyNet)}`
      ]
    };

    const sponsorEntries = payload.ledgerEntries.filter((entry) =>
      `${entry.type} ${entry.description}`.toUpperCase().includes('SPONSOR')
    );
    const sponsorBase = sponsorEntries.reduce(
      (sum, entry) => sum + Math.abs(Number(entry.amount || 0)),
      0
    );
    const sponsorUp = sponsorBase * 1.1;
    const sponsorDown = sponsorBase * 0.9;

    const transferOut = payload.transfers
      .filter((t) => t.direction === 'ACQUISITION')
      .reduce((sum, t) => sum + Number(t.totalFee || 0), 0);
    const transferIn = payload.transfers
      .filter((t) => t.direction === 'TRANSFER')
      .reduce((sum, t) => sum + Number(t.totalFee || 0), 0);
    const transferNet = transferIn - transferOut;

    const sponsorTransferImpact = {
      sponsorBase: Math.round(sponsorBase),
      sponsorPlus10: Math.round(sponsorUp),
      sponsorMinus10: Math.round(sponsorDown),
      transferNet: Math.round(transferNet),
      scenario: {
        sponsorImpactPlus10: Math.round(sponsorUp - sponsorBase),
        sponsorImpactMinus10: Math.round(sponsorDown - sponsorBase),
        transferNet
      }
    };

    return {
      forecast,
      cashflowRisk,
      sponsorTransferImpact
    };
  }

  private buildFallbackInsights(payload: {
    budgetItems: Array<{ category: string; threshold: number; utilized: number }>;
    focusCategories: string[];
    ledgerEntries: Array<{ entryDate: Date; type: string; amount: number; status: string }>;
    upcomingTranches: Array<{ dueDate: Date; amount: number; direction: string }>;
    payrollRuns: Array<{
      periodStart: Date;
      periodEnd: Date;
      totalAmount: number;
      status: string;
    }>;
  }) {
    const totalThreshold = payload.budgetItems.reduce(
      (sum, item) => sum + Number(item.threshold || 0),
      0
    );
    const totalUtilized = payload.budgetItems.reduce(
      (sum, item) => sum + Number(item.utilized || 0),
      0
    );
    const usageRatio = totalThreshold > 0 ? (totalUtilized / totalThreshold) * 100 : 0;

    const openTranchesAmount = payload.upcomingTranches.reduce(
      (sum, item) => sum + Number(item.amount || 0),
      0
    );
    const payrollPressure = payload.payrollRuns.reduce(
      (sum, run) => sum + Number(run.totalAmount || 0),
      0
    );

    const budgetForecast = {
      title: 'Prévision budget',
      summary:
        usageRatio >= 85
          ? 'Alerte: consommation budgétaire élevée, risque de dépassement.'
          : 'Trajectoire budgétaire sous contrôle avec surveillance recommandée.',
      details: [
        'Analyse fallback locale (OpenAI indisponible).',
        `Utilisation budget: ${usageRatio.toFixed(1)}% (${totalUtilized.toFixed(0)} / ${totalThreshold.toFixed(0)})`,
        `Engagement tranches à venir: ${openTranchesAmount.toFixed(0)}`,
        `Pression paie récente: ${payrollPressure.toFixed(0)}`,
        usageRatio >= 85
          ? 'Action: geler dépenses non essentielles et déclencher validation renforcée.'
          : 'Action: maintenir les plafonds et suivre les catégories les plus dynamiques.'
      ].join('\n')
    };

    const topCategories = [...payload.budgetItems]
      .sort((a, b) => Number(b.utilized || 0) - Number(a.utilized || 0))
      .slice(0, 3)
      .map((item) => item.category);

    const expenseOptimization = {
      title: 'Optimisation dépenses',
      summary:
        topCategories.length > 0
          ? `Priorité optimisation: ${topCategories.join(', ')}.`
          : 'Données insuffisantes pour prioriser les catégories.',
      details: [
        'Plan d’optimisation fallback locale:',
        '- Mettre un seuil d’alerte à 80% et 95% sur chaque catégorie.',
        '- Réduire de 5% les dépenses variables (transport/marketing/achats).',
        '- Négocier les contrats fournisseurs sur les 3 catégories les plus consommatrices.',
        topCategories.length > 0
          ? `Catégories ciblées: ${topCategories.join(', ')}`
          : 'Ajoutez plus de données budget pour des recommandations plus fines.'
      ].join('\n')
    };

    return { budgetForecast, expenseOptimization };
  }
}
