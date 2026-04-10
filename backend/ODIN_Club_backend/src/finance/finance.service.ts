import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, Types } from 'mongoose';
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
    private readonly configService: ConfigService
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

    const analytics = this.buildFinanceAiAnalytics({
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
        manual: account.manual
      }))
    });

    const fallback = this.buildFallbackInsights({
      budgetItems: budget.items,
      focusCategories: dto.focusCategories ?? [],
      ledgerEntries: ledgerEntries.map((entry) => ({
        entryDate: entry.entryDate,
        type: entry.type,
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
      }))
    });

    return {
      source: 'analytics-local',
      generatedAt: new Date().toISOString(),
      generationTimeMs: Date.now() - start,
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
    if (amount < 0) {
      return true;
    }
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
      if (this.isExpenseEntry(entry.type, entry.description, entry.amount)) {
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
    const confidence = Math.min(92, 40 + seasons.length * 15);

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
      confidence: Math.round(confidence)
    };

    const treasuryBalance = payload.treasuryAccounts.reduce(
      (sum, account) => sum + Number(account.balance || 0),
      0
    );
    const now = new Date();
    const horizonLimit = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
    const upcomingOutflows = payload.upcomingTranches
      .filter((tranche) => tranche.direction === 'ACQUISITION' && new Date(tranche.dueDate) <= horizonLimit)
      .reduce((sum, tranche) => sum + Number(tranche.amount || 0), 0);
    const upcomingInflows = payload.upcomingTranches
      .filter((tranche) => tranche.direction === 'TRANSFER' && new Date(tranche.dueDate) <= horizonLimit)
      .reduce((sum, tranche) => sum + Number(tranche.amount || 0), 0);
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
            return sum + (this.isExpenseEntry(entry.type, entry.description, entry.amount) ? -amount : amount);
          }, 0) / 6;
    const projectedCash =
      treasuryBalance + upcomingInflows - upcomingOutflows - payrollForecast + monthlyNet * 3;
    const cashCoverage = upcomingOutflows <= 0 ? 2 : projectedCash / upcomingOutflows;

    let level: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW';
    let score = 20;
    if (projectedCash < 0 || cashCoverage < 0.5) {
      level = 'HIGH';
      score = 85;
    } else if (cashCoverage < 1.2) {
      level = 'MEDIUM';
      score = 55;
    }

    const cashflowRisk = {
      horizonDays: 90,
      treasuryBalance: Math.round(treasuryBalance),
      projectedCash: Math.round(projectedCash),
      upcomingOutflows: Math.round(upcomingOutflows + payrollForecast),
      upcomingInflows: Math.round(upcomingInflows),
      monthlyNet: Math.round(monthlyNet),
      level,
      score,
      notes: [
        `Couverture cash estimée: ${cashCoverage.toFixed(2)}x`,
        `Masse salariale projetée (90j): ${Math.round(payrollForecast)}`,
        `Flux net mensuel récent: ${Math.round(monthlyNet)}`
      ]
    };

    const transferOut = payload.transfers
      .filter((t) => t.direction === 'ACQUISITION')
      .reduce((sum, t) => sum + Number(t.totalFee || 0), 0);
    const transferIn = payload.transfers
      .filter((t) => t.direction === 'TRANSFER')
      .reduce((sum, t) => sum + Number(t.totalFee || 0), 0);
    const transferNet = transferIn - transferOut;
    const sponsorEntries = payload.ledgerEntries.filter((entry) =>
      `${entry.type} ${entry.description}`.toUpperCase().includes('SPONSOR')
    );
    const sponsorBase = sponsorEntries.reduce(
      (sum, entry) => sum + Math.abs(Number(entry.amount || 0)),
      0
    );
    const sponsorPlus = sponsorBase * 1.1;
    const sponsorMinus = sponsorBase * 0.9;

    const sponsorTransferImpact = {
      sponsorBase: Math.round(sponsorBase),
      sponsorPlus10: Math.round(sponsorPlus),
      sponsorMinus10: Math.round(sponsorMinus),
      transferNet: Math.round(transferNet),
      scenario: {
        sponsorImpactPlus10: Math.round(sponsorPlus - sponsorBase),
        sponsorImpactMinus10: Math.round(sponsorMinus - sponsorBase),
        transferNet: Math.round(transferNet)
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
    const topCategories = [...payload.budgetItems]
      .sort((a, b) => Number(b.utilized || 0) - Number(a.utilized || 0))
      .slice(0, 3)
      .map((item) => item.category);

    return {
      budgetForecast: {
        title: 'Prévision budget',
        summary:
          usageRatio >= 85
            ? 'Alerte: consommation budgétaire élevée, risque de dépassement.'
            : 'Trajectoire budgétaire sous contrôle avec surveillance recommandée.',
        details: [
          `Utilisation budget: ${usageRatio.toFixed(1)}%`,
          `Engagement tranches à venir: ${openTranchesAmount.toFixed(0)}`,
          `Pression paie récente: ${payrollPressure.toFixed(0)}`
        ].join('\n')
      },
      expenseOptimization: {
        title: 'Optimisation dépenses',
        summary:
          topCategories.length > 0
            ? `Priorité optimisation: ${topCategories.join(', ')}.`
            : 'Données insuffisantes pour prioriser les catégories.',
        details: [
          'Mettre un seuil d’alerte à 80% et 95% sur chaque catégorie.',
          'Réduire de 5% les dépenses variables les plus consommatrices.',
          topCategories.length > 0
            ? `Catégories ciblées: ${topCategories.join(', ')}`
            : 'Ajoutez plus de données budget pour des recommandations plus fines.'
        ].join('\n')
      }
    };
  }
}
