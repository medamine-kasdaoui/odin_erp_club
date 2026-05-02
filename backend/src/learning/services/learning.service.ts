import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { existsSync, readFileSync } from 'fs';
import { Model, Types } from 'mongoose';
import { join } from 'path';
import { MedicalService } from '../../medical/medical.service';
import { PlayersService } from '../../players/players.service';
import { Player } from '../../players/schemas/player.schema';
import { SubmitQuizDto } from '../dto/submit-quiz.dto';
import { UpdateProgressDto } from '../dto/update-progress.dto';
import { Course, CourseDocument, CourseLevel, CourseType } from '../schemas/course.schema';
import { LearningExercise, LearningExerciseDocument } from '../schemas/exercise.schema';
import { LearningImage, LearningImageDocument } from '../schemas/learning-image.schema';
import { Lesson, LessonDocument } from '../schemas/lesson.schema';
import { Progress, ProgressDocument } from '../schemas/progress.schema';
import { Quiz, QuizDocument } from '../schemas/quiz.schema';

type RecommendationReason = {
  code: string;
  label: string;
};

@Injectable()
export class LearningService implements OnModuleInit {
  private readonly logger = new Logger(LearningService.name);
  private seeded = false;

  constructor(
    @InjectModel(Course.name) private readonly courseModel: Model<CourseDocument>,
    @InjectModel(Lesson.name) private readonly lessonModel: Model<LessonDocument>,
    @InjectModel(Progress.name) private readonly progressModel: Model<ProgressDocument>,
    @InjectModel(Quiz.name) private readonly quizModel: Model<QuizDocument>,
    @InjectModel(LearningExercise.name)
    private readonly exerciseModel: Model<LearningExerciseDocument>,
    @InjectModel(LearningImage.name) private readonly imageModel: Model<LearningImageDocument>,
    private readonly playersService: PlayersService,
    private readonly medicalService: MedicalService,
  ) {}

  async onModuleInit() {
    await this.ensureDefaultContent();
  }

  async getCourses(playerId?: string): Promise<any[]> {
    await this.ensureDefaultContent();
    const courses = await this.courseModel.find().sort({ order: 1, title: 1 }).lean();
    const lessonCounts = await this.lessonModel.aggregate([
      { $group: { _id: '$courseId', count: { $sum: 1 } } },
    ]);
    const countsByCourse = new Map(
      lessonCounts.map((item) => [item._id.toString(), item.count as number]),
    );

    let progressByCourse = new Map<string, any>();
    if (playerId && Types.ObjectId.isValid(playerId)) {
      try {
        const resolvedPlayerId = await this.resolvePlayerObjectId(playerId);
        const progress = await this.progressModel
          .find({ playerId: resolvedPlayerId })
          .lean();
        progressByCourse = new Map(progress.map((item) => [item.courseId.toString(), item]));
      } catch (_) {
        progressByCourse = new Map();
      }
    }

    return courses.map((course: any) => ({
      ...course,
      id: course._id.toString(),
      lessonCount: countsByCourse.get(course._id.toString()) ?? 0,
      progress: progressByCourse.get(course._id.toString()) ?? null,
    }));
  }

  async getCourseLessons(courseId: string): Promise<any> {
    this.assertObjectId(courseId, 'courseId');
    await this.ensureDefaultContent();
    const course = await this.courseModel.findById(courseId).lean();
    if (!course) {
      throw new NotFoundException('Course not found');
    }

    const lessons = await this.lessonModel
      .find({ courseId: new Types.ObjectId(courseId) })
      .sort({ order: 1 })
      .lean();

    return {
      course: { ...course, id: course._id.toString() },
      lessons: lessons.map((lesson: any) => ({
        ...lesson,
        id: lesson._id.toString(),
        courseId: lesson.courseId.toString(),
      })),
    };
  }

  async getExercisesForLesson(lessonId: string): Promise<any[]> {
    this.assertObjectId(lessonId, 'lessonId');
    await this.ensureDefaultContent();
    const lesson = await this.lessonModel.findById(lessonId).lean();
    if (!lesson) {
      throw new NotFoundException('Lesson not found');
    }

    const exercises = await this.exerciseModel
      .find({ lessonObjectId: new Types.ObjectId(lessonId), isActive: true })
      .sort({ page: 1, externalId: 1 })
      .lean();

    return exercises.map((exercise: any) => this.serializeExercise(exercise));
  }

  async getExercise(exerciseId: string): Promise<any> {
    await this.ensureDefaultContent();
    const exercise = await this.exerciseModel
      .findOne({
        $or: [
          { externalId: exerciseId },
          ...(Types.ObjectId.isValid(exerciseId)
            ? [{ _id: new Types.ObjectId(exerciseId) }]
            : []),
        ],
      })
      .lean();
    if (!exercise) {
      throw new NotFoundException('Exercise not found');
    }
    return this.serializeExercise(exercise);
  }

  async getImagesByPage(pageNumber: number): Promise<any[]> {
    await this.ensureDefaultContent();
    const images = await this.imageModel.find({ pageNumber }).sort({ type: -1 }).lean();
    return images.map((image: any) => ({
      ...image,
      id: image._id.toString(),
      externalId: image.externalId,
    }));
  }

  async updateProgress(dto: UpdateProgressDto): Promise<any> {
    this.assertObjectId(dto.courseId, 'courseId');
    const playerId = await this.resolvePlayerObjectId(dto.playerId);
    const courseId = new Types.ObjectId(dto.courseId);
    const course = await this.courseModel.findById(courseId).lean();
    if (!course) {
      throw new NotFoundException('Course not found');
    }

    const update: Record<string, any> = {
      $set: {
        playerId,
        courseId,
      },
    };

    if (dto.lessonId) {
      this.assertObjectId(dto.lessonId, 'lessonId');
      const lessonId = new Types.ObjectId(dto.lessonId);
      const lesson = await this.lessonModel.findOne({ _id: lessonId, courseId }).lean();
      if (!lesson) {
        throw new NotFoundException('Lesson not found for this course');
      }
      update.$set.lastLessonId = lessonId;
      update.$addToSet = { completedLessons: lessonId };
    }

    if (typeof dto.progressPercentage === 'number') {
      update.$set.progressPercentage = this.clamp(dto.progressPercentage);
    }

    if (typeof dto.completed === 'boolean') {
      update.$set.completed = dto.completed;
      if (dto.completed) {
        update.$set.progressPercentage = 100;
        update.$set.earnedBadge = course.badgeName ?? 'ODIN English Certificate';
      }
    }

    let progress = await this.progressModel
      .findOneAndUpdate({ playerId, courseId }, update, { upsert: true, new: true })
      .lean();

    if (dto.lessonId && typeof dto.progressPercentage !== 'number' && dto.completed !== true) {
      progress = await this.recalculateProgress(playerId, courseId);
    }

    return this.serializeProgress(progress);
  }

  async getPlayerProgress(playerIdOrUserId: string): Promise<any> {
    const playerId = await this.resolvePlayerObjectId(playerIdOrUserId);
    const [progress, courses] = await Promise.all([
      this.progressModel.find({ playerId }).sort({ updatedAt: -1 }).lean(),
      this.courseModel.find().lean(),
    ]);

    const coursesById = new Map(courses.map((course: any) => [course._id.toString(), course]));
    const items = progress.map((item: any) => {
      const course = coursesById.get(item.courseId.toString());
      return {
        ...this.serializeProgress(item),
        course: course
          ? {
              ...course,
              id: course._id.toString(),
            }
          : null,
      };
    });

    const completed = items.filter((item) => item.completed).length;
    const averageProgress =
      items.length === 0
        ? 0
        : Math.round(
            items.reduce((sum, item) => sum + Number(item.progressPercentage ?? 0), 0) /
              items.length,
          );

    return {
      playerId: playerId.toString(),
      completedCourses: completed,
      activeCourses: items.filter((item) => !item.completed).length,
      averageProgress,
      items,
      certificates: items
        .filter((item) => item.earnedBadge)
        .map((item) => ({
          courseId: item.courseId,
          badgeName: item.earnedBadge,
          earnedAt: item.updatedAt,
        })),
    };
  }

  async getQuizForLesson(lessonId: string): Promise<any[]> {
    this.assertObjectId(lessonId, 'lessonId');
    const lesson = await this.lessonModel.findById(lessonId).lean();
    if (!lesson) {
      throw new NotFoundException('Lesson not found');
    }
    const questions = await this.quizModel
      .find({ lessonId: new Types.ObjectId(lessonId) })
      .sort({ order: 1 })
      .lean();

    return questions.map((question: any) => ({
      id: question._id.toString(),
      lessonId: question.lessonId.toString(),
      question: question.question,
      options: question.options,
      explanation: question.explanation,
      order: question.order,
    }));
  }

  async submitQuiz(dto: SubmitQuizDto): Promise<any> {
    this.assertObjectId(dto.lessonId, 'lessonId');
    const lesson = await this.lessonModel.findById(dto.lessonId).lean();
    if (!lesson) {
      throw new NotFoundException('Lesson not found');
    }

    const quizIds = dto.answers.map((answer) => new Types.ObjectId(answer.quizId));
    const questions = await this.quizModel
      .find({
        _id: { $in: quizIds },
        lessonId: new Types.ObjectId(dto.lessonId),
      })
      .lean();

    if (questions.length !== dto.answers.length) {
      throw new BadRequestException('Some quiz answers do not belong to this lesson');
    }

    const answersById = new Map(dto.answers.map((answer) => [answer.quizId, answer.answer]));
    const results = questions.map((question: any) => {
      const selectedAnswer = answersById.get(question._id.toString()) ?? '';
      const correct = this.normalizeAnswer(selectedAnswer) === this.normalizeAnswer(question.correctAnswer);
      return {
        quizId: question._id.toString(),
        question: question.question,
        selectedAnswer,
        correctAnswer: question.correctAnswer,
        correct,
        explanation: question.explanation,
      };
    });

    const correctAnswers = results.filter((result) => result.correct).length;
    const scorePercentage = Math.round((correctAnswers / results.length) * 100);
    const passed = scorePercentage >= 70;

    let progress: any = null;
    if (passed && dto.playerId) {
      progress = await this.updateProgress({
        playerId: dto.playerId,
        courseId: lesson.courseId.toString(),
        lessonId: dto.lessonId,
      });
    }

    return {
      lessonId: dto.lessonId,
      totalQuestions: results.length,
      correctAnswers,
      scorePercentage,
      passed,
      results,
      progress,
    };
  }

  async recommendCourses(playerIdOrUserId: string): Promise<any> {
    await this.ensureDefaultContent();
    let player: Player;
    try {
      player = await this.resolvePlayer(playerIdOrUserId);
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      this.logger.warn(
        `No linked player found for learning user ${playerIdOrUserId}; returning starter recommendations.`,
      );
      return this.defaultLearningContext(playerIdOrUserId);
    }

    const playerId = (player as any)._id.toString();
    const positionGroup = this.normalizePosition(player.position);
    const performanceLevel = this.getPerformanceLevel(player);
    const medicalHistory = await this.safeMedicalHistory(playerId);
    const hasMedicalRisk =
      player.isInjured === true ||
      Number(player.injuries ?? player.injuryHistory ?? 0) > 0 ||
      medicalHistory.some((record: any) => record.injured || record.injuryProbability >= 45);

    const courses = await this.courseModel.find().sort({ order: 1 }).lean();
    const progress = await this.progressModel.find({ playerId: new Types.ObjectId(playerId) }).lean();
    const progressByCourse = new Map(progress.map((item: any) => [item.courseId.toString(), item]));

    const recommendations = courses
      .map((course: any) => {
        const reasons: RecommendationReason[] = [];
        let score = 0;

        if (course.recommendedPositions?.includes('ALL')) {
          score += 10;
        }
        if (course.recommendedPositions?.includes(positionGroup)) {
          score += 35;
          reasons.push({ code: 'POSITION', label: `Built for ${positionGroup.toLowerCase()} communication` });
        }
        if (this.levelFits(course.level, performanceLevel)) {
          score += 25;
          reasons.push({ code: 'PERFORMANCE', label: `Matches ${performanceLevel.toLowerCase()} performance level` });
        }
        if (course.medicalFocus && hasMedicalRisk) {
          score += 45;
          reasons.push({ code: 'MEDICAL', label: 'Covers injury reporting and physio dialogue' });
        }
        if (course.type === CourseType.MEDIA && performanceLevel !== 'DEVELOPING') {
          score += 15;
          reasons.push({ code: 'MEDIA', label: 'Useful for interviews and press conferences' });
        }

        const courseProgress = progressByCourse.get(course._id.toString());
        if (courseProgress?.completed) {
          score -= 50;
        }

        return {
          ...course,
          id: course._id.toString(),
          score,
          reasons,
          progress: courseProgress ? this.serializeProgress(courseProgress) : null,
        };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    const injuryLessons = hasMedicalRisk
      ? await this.lessonModel.find({ injuryCommunication: true }).limit(4).lean()
      : [];

    return {
      player: {
        id: playerId,
        name: this.playerName(player),
        position: player.position ?? 'Unknown',
        performanceLevel,
        isInjured: player.isInjured ?? false,
      },
      medical: {
        hasMedicalRisk,
        latestRecords: medicalHistory.slice(0, 3),
        suggestedLessons: injuryLessons.map((lesson: any) => ({
          ...lesson,
          id: lesson._id.toString(),
          courseId: lesson.courseId.toString(),
        })),
      },
      recommendations,
    };
  }

  async getLearningDashboard(playerIdOrUserId: string): Promise<any> {
    const [progress, recommendations] = await Promise.all([
      this.getPlayerProgress(playerIdOrUserId),
      this.recommendCourses(playerIdOrUserId),
    ]);

    return {
      player: recommendations.player,
      communicationScore: Math.min(100, Math.round(50 + progress.averageProgress * 0.45)),
      progress,
      recommendations: recommendations.recommendations,
      weakPoints: recommendations.medical.hasMedicalRisk
        ? [
            {
              title: 'Medical Vocabulary',
              status: 'Critical',
              focus: 'Injury reporting and physio dialogue',
              tags: ['Hamstring strains', 'Recovery protocols', 'Anatomy terminology'],
            },
          ]
        : [
            {
              title: 'Press Conference Rhythm',
              status: 'Recommended',
              focus: 'Short, confident answers under media pressure',
              tags: ['Bridge phrases', 'Composure', 'Team-first answers'],
            },
          ],
      medical: recommendations.medical,
    };
  }

  private async recalculateProgress(playerId: Types.ObjectId, courseId: Types.ObjectId) {
    const [progress, lessonCount] = await Promise.all([
      this.progressModel.findOne({ playerId, courseId }),
      this.lessonModel.countDocuments({ courseId }),
    ]);

    if (!progress) {
      throw new NotFoundException('Progress not found');
    }

    const completedLessons = new Set(
      (progress.completedLessons ?? []).map((lessonId: any) => lessonId.toString()),
    );
    const progressPercentage =
      lessonCount === 0 ? 0 : Math.min(100, Math.round((completedLessons.size / lessonCount) * 100));
    const course = await this.courseModel.findById(courseId).lean();
    progress.progressPercentage = progressPercentage;
    progress.completed = progressPercentage >= 100;
    progress.earnedBadge = progress.completed
      ? course?.badgeName ?? 'ODIN English Certificate'
      : progress.earnedBadge;
    await progress.save();
    return progress.toObject();
  }

  private async resolvePlayer(playerIdOrUserId: string): Promise<Player> {
    if (!Types.ObjectId.isValid(playerIdOrUserId)) {
      throw new BadRequestException('Invalid playerId');
    }
    return this.playersService.resolveByAnyId(playerIdOrUserId);
  }

  private async resolvePlayerObjectId(playerIdOrUserId: string): Promise<Types.ObjectId> {
    try {
      const player = await this.resolvePlayer(playerIdOrUserId);
      return new Types.ObjectId((player as any)._id.toString());
    } catch (error) {
      if (!Types.ObjectId.isValid(playerIdOrUserId)) {
        throw new BadRequestException('Invalid playerId');
      }
      this.logger.warn(
        `Using userId ${playerIdOrUserId} as learning progress owner because no linked player exists.`,
      );
      return new Types.ObjectId(playerIdOrUserId);
    }
  }

  private async defaultLearningContext(playerIdOrUserId: string): Promise<any> {
    const progressOwnerId = Types.ObjectId.isValid(playerIdOrUserId)
      ? new Types.ObjectId(playerIdOrUserId)
      : null;
    const [courses, progress] = await Promise.all([
      this.courseModel.find().sort({ order: 1, title: 1 }).lean(),
      progressOwnerId
        ? this.progressModel.find({ playerId: progressOwnerId }).lean()
        : Promise.resolve([]),
    ]);
    const progressByCourse = new Map(
      progress.map((item: any) => [item.courseId.toString(), item]),
    );

    const recommendations = courses
      .map((course: any) => {
        let score = 10;
        const reasons: RecommendationReason[] = [];
        if (course.slug === 'english-for-sportive-purposes-odin-esport') {
          score += 50;
          reasons.push({ code: 'ESP', label: 'Start with the ODIN ESPORT English course' });
        }
        if (course.recommendedPositions?.includes('ALL')) {
          score += 15;
          reasons.push({ code: 'FOUNDATION', label: 'Suitable for all player profiles' });
        }
        if (course.type === CourseType.FOUNDATION) {
          score += 10;
        }
        const courseProgress = progressByCourse.get(course._id.toString());
        if (courseProgress?.completed) {
          score -= 50;
        }
        return {
          ...course,
          id: course._id.toString(),
          score,
          reasons,
          progress: courseProgress ? this.serializeProgress(courseProgress) : null,
        };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    return {
      player: {
        id: playerIdOrUserId,
        name: 'ODIN Player',
        position: 'Player',
        performanceLevel: 'DEVELOPING',
        isInjured: false,
        profileLinked: false,
      },
      medical: {
        hasMedicalRisk: false,
        latestRecords: [],
        suggestedLessons: [],
      },
      recommendations,
    };
  }

  private async safeMedicalHistory(playerId: string) {
    try {
      return await this.medicalService.getHistory(playerId);
    } catch (error) {
      this.logger.warn(`Unable to load medical learning context for player ${playerId}`);
      return [];
    }
  }

  private getPerformanceLevel(player: Player): 'DEVELOPING' | 'MATCH_READY' | 'ELITE' {
    const stats = player.statistics;
    const average =
      (Number(player.speed ?? 0) +
        Number(player.endurance ?? 0) +
        Number(player.baseFitness ?? 75) +
        Number(stats?.averageScore ?? 70)) /
      4;

    if (average >= 82) return 'ELITE';
    if (average >= 65) return 'MATCH_READY';
    return 'DEVELOPING';
  }

  private normalizePosition(position?: string): string {
    const value = (position ?? '').toLowerCase();
    if (value.includes('goal') || value === 'gk') return 'GK';
    if (value.includes('def') || value.includes('back') || value.includes('cb') || value.includes('lb') || value.includes('rb')) {
      return 'DEF';
    }
    if (value.includes('mid') || value.includes('cm') || value.includes('dm') || value.includes('am')) return 'MID';
    if (value.includes('wing') || value.includes('striker') || value.includes('forward') || value.includes('att')) return 'ATT';
    return 'ALL';
  }

  private levelFits(level: CourseLevel, performanceLevel: string): boolean {
    if (performanceLevel === 'ELITE') {
      return [CourseLevel.B2, CourseLevel.ELITE].includes(level);
    }
    if (performanceLevel === 'MATCH_READY') {
      return [CourseLevel.B1, CourseLevel.B2].includes(level);
    }
    return [CourseLevel.A1, CourseLevel.A2, CourseLevel.B1].includes(level);
  }

  private playerName(player: Player): string {
    return (
      player.name ||
      `${player.firstName ?? ''} ${player.lastName ?? ''}`.trim() ||
      'ODIN Player'
    );
  }

  private serializeProgress(progress: any) {
    if (!progress) return null;
    return {
      id: progress._id?.toString?.() ?? progress.id,
      playerId: progress.playerId?.toString?.() ?? progress.playerId,
      courseId: progress.courseId?.toString?.() ?? progress.courseId,
      progressPercentage: progress.progressPercentage ?? 0,
      completed: progress.completed ?? false,
      completedLessons: (progress.completedLessons ?? []).map((id: any) => id.toString()),
      lastLessonId: progress.lastLessonId?.toString?.() ?? progress.lastLessonId,
      earnedBadge: progress.earnedBadge,
      createdAt: progress.createdAt,
      updatedAt: progress.updatedAt,
    };
  }

  private serializeExercise(exercise: any) {
    const sourcePageImage = this.cleanAssetUrl(exercise.sourcePageImage);
    const assets = (exercise.assets ?? [])
      .map((asset: any) => ({
        ...asset,
        url: this.cleanAssetUrl(asset?.url),
      }))
      .filter((asset: any) => asset.url);
    const matching = exercise.type === 'matching' ? this.buildMatchingExercise(exercise) : null;
    const fillBlanks =
      exercise.type === 'fill_blank' ? this.buildFillBlankExercise(exercise) : [];
    const hasDragPairs =
      matching !== null && matching.left.length > 1 && matching.right.length > 1;

    return {
      ...exercise,
      id: exercise._id?.toString?.() ?? exercise.id,
      externalId: exercise.externalId,
      lessonObjectId: exercise.lessonObjectId?.toString?.() ?? exercise.lessonObjectId,
      interactionType: hasDragPairs ? 'drag_drop_matching' : exercise.type,
      assets,
      sourcePageImage,
      matching,
      fillBlanks,
    };
  }

  private cleanAssetUrl(url?: string) {
    if (!url || ['sourcePage', 'sourcePageImage', 'requiresOriginalVisualCheck'].includes(url)) {
      return undefined;
    }
    return url;
  }

  private buildMatchingExercise(exercise: any) {
    const explicit = exercise.answerKey?.dragDrop;
    if (explicit?.left?.length && explicit?.right?.length) {
      return {
        mode: explicit.mode ?? 'drag_drop',
        instruction: explicit.instruction ?? 'Drag each answer card to the correct image.',
        left: explicit.left.map((item: any) => ({
          ...item,
          imageUrl: this.cleanAssetUrl(item?.imageUrl),
        })),
        right: explicit.right.map((item: any) => ({
          ...item,
          imageUrl: this.cleanAssetUrl(item?.imageUrl),
        })),
        answerMap: explicit.answerMap ?? {},
        manualCorrection: Object.keys(explicit.answerMap ?? {}).length === 0,
      };
    }

    const prompt = String(exercise.prompt ?? '');
    const answerMap = this.parseAnswerMap(exercise.answerKey);
    const left = this.extractLeftItems(prompt, exercise.questions ?? []);
    const right = this.extractRightItems(prompt, exercise.options ?? []);

    return {
      mode: 'drag_drop',
      instruction: 'Drag each answer card to the correct slot.',
      left,
      right,
      answerMap,
      manualCorrection: Object.keys(answerMap).length === 0,
    };
  }

  private buildFillBlankExercise(exercise: any) {
    const items = Array.isArray(exercise.answerKey?.fillBlanks)
      ? exercise.answerKey.fillBlanks
      : [];

    return items.map((item: any, index: number) => ({
      id: String(item.id ?? index + 1),
      sentence: String(item.sentence ?? ''),
      imageUrl: this.cleanAssetUrl(item.imageUrl),
      answers: Array.isArray(item.answers)
        ? item.answers.map((answer: any) => String(answer))
        : [],
      hint: item.hint ? String(item.hint) : undefined,
    }));
  }

  private parseAnswerMap(answerKey: any): Record<string, string> {
    if (answerKey?.dragDrop?.answerMap) {
      return answerKey.dragDrop.answerMap;
    }

    const values = Array.isArray(answerKey?.answers)
      ? answerKey.answers
      : Array.isArray(answerKey?.items)
        ? answerKey.items
        : [];
    const map: Record<string, string> = {};
    for (const value of values) {
      const text = String(value);
      const match = text.match(/(\d+)\s*[-:]\s*([a-z])/i);
      if (match) {
        map[match[1]] = match[2].toLowerCase();
      }
    }
    return map;
  }

  private extractLeftItems(prompt: string, questions: any[]) {
    const seen = new Set<string>();
    const items: Array<{ id: string; label: string }> = [];

    const add = (id: string, label: string) => {
      const cleaned = this.cleanMatchingLabel(label);
      if (!cleaned || seen.has(id)) return;
      seen.add(id);
      items.push({ id, label: cleaned });
    };

    for (const question of questions) {
      const text = String(question);
      const id = text.match(/^\s*(\d+)/)?.[1] ?? String(items.length + 1);
      add(id, text.replace(/^\s*\d+\s*[.)]?\s*/, '').replace(/→.*$/, ''));
    }

    const arrowPattern = /\b(\d+)\s*[.)]\s*([^→]+?)\s*→/g;
    for (const match of prompt.matchAll(arrowPattern)) {
      add(match[1], match[2]);
    }

    if (items.length === 0) {
      const compactPattern = /\b(\d+)\s*[.)]\s*([A-Z][A-Za-z][A-Za-z\s/-]{2,42}?)(?=\s+\d+\s*[.)]|\s+[a-g]\s*[.)]|$)/g;
      for (const match of prompt.matchAll(compactPattern)) {
        add(match[1], match[2]);
      }
    }

    return items.slice(0, 10);
  }

  private extractRightItems(prompt: string, options: string[]) {
    const seen = new Set<string>();
    const items: Array<{ id: string; label: string }> = [];

    const add = (id: string, label: string) => {
      const cleaned = this.cleanMatchingLabel(label);
      if (!cleaned || seen.has(id)) return;
      seen.add(id);
      items.push({ id, label: cleaned });
    };

    options.forEach((option, index) => {
      add(String.fromCharCode(97 + index), option);
    });

    const letterPattern = /\b([a-g])\s*[.)]\s*(.*?)(?=\s+\d+\s*[.)]|\s+[a-g]\s*[.)]|$)/gi;
    for (const match of prompt.matchAll(letterPattern)) {
      add(match[1].toLowerCase(), match[2]);
    }

    return items.slice(0, 10);
  }

  private cleanMatchingLabel(label: string) {
    return label
      .replace(/_/g, ' ')
      .replace(/\s+/g, ' ')
      .replace(/^[a-g]\s*[.)]\s*/i, '')
      .replace(/^\d+\s*[.)]\s*/, '')
      .replace(/\s*→\s*$/, '')
      .trim();
  }

  private normalizeAnswer(answer: string) {
    return answer.trim().toLowerCase();
  }

  private clamp(value: number) {
    return Math.min(100, Math.max(0, Math.round(value)));
  }

  private assertObjectId(id: string, field: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException(`Invalid ${field}`);
    }
  }

  private async ensureDefaultContent() {
    if (this.seeded) return;

    await this.seedDefaultCourses();
    await this.seedEspDataset();

    this.seeded = true;
  }

  private async seedDefaultCourses() {
    const defaultCourses = this.defaultCourses();
    for (const item of defaultCourses) {
      const { lessons, ...coursePayload } = item;
      const course = await this.courseModel.findOneAndUpdate(
        { slug: coursePayload.slug },
        { $setOnInsert: coursePayload },
        { upsert: true, new: true },
      );

      for (const lessonPayload of lessons) {
        const { quizzes, ...lessonData } = lessonPayload;
        const lesson = await this.lessonModel.findOneAndUpdate(
          { courseId: course._id, order: lessonData.order },
          { $setOnInsert: { ...lessonData, courseId: course._id } },
          { upsert: true, new: true },
        );

        for (const quizPayload of quizzes) {
          await this.quizModel.findOneAndUpdate(
            { lessonId: lesson._id, order: quizPayload.order },
            { $setOnInsert: { ...quizPayload, lessonId: lesson._id } },
            { upsert: true },
          );
        }
      }
    }
  }

  private async seedEspDataset() {
    const datasetRoot = join(process.cwd(), 'learning_assets', 'mongo_collections');
    const lessonsPath = join(datasetRoot, 'lessons.json');
    const exercisesPath = join(datasetRoot, 'exercises.json');
    const imagesPath = join(datasetRoot, 'images.json');

    if (!existsSync(lessonsPath) || !existsSync(exercisesPath) || !existsSync(imagesPath)) {
      this.logger.warn('ESP dataset files not found. Skipping PDF dataset seed.');
      return;
    }

    const lessonsData = JSON.parse(readFileSync(lessonsPath, 'utf8')) as any[];
    const exercisesData = JSON.parse(readFileSync(exercisesPath, 'utf8')) as any[];
    const imagesData = JSON.parse(readFileSync(imagesPath, 'utf8')) as any[];

    await this.dropLegacyExerciseIndexes();

    const course = await this.courseModel.findOneAndUpdate(
      { slug: 'esp-english-for-sportive-purposes' },
      {
        $set: {
          slug: 'esp-english-for-sportive-purposes',
          title: 'ESP English for Sportive Purposes',
          description:
            'PDF-based ODIN E-Sport English course covering sports vocabulary, coaching communication, competitions, fitness, medical language, and global sports communication.',
          level: CourseLevel.B1,
          type: CourseType.FOUNDATION,
          recommendedPositions: ['ALL'],
          tags: ['esp', 'sports vocabulary', 'coaching', 'medical', 'culture'],
          estimatedMinutes: Math.max(lessonsData.length * 18, 90),
          thumbnailUrl: '/assets/pages/page_001.jpg',
          badgeName: 'ESP Sportive Purposes Certificate',
          medicalFocus: true,
          order: 0,
          sourcePdf: 'ESP ENGLISH for Sportive purposes ODIN E SPORT.pdf',
          datasetVersion: 'odin_esport_app_dataset_with_images',
        },
      },
      { upsert: true, new: true },
    );

    const lessonIdByExternalId = new Map<string, Types.ObjectId>();
    for (const datasetLesson of lessonsData) {
      const lesson = await this.lessonModel.findOneAndUpdate(
        { externalId: datasetLesson._id },
        {
          $set: {
            externalId: datasetLesson._id,
            courseId: course._id,
            title: datasetLesson.title,
            content: datasetLesson.description ?? '',
            order: datasetLesson.order,
            durationMinutes: Math.max((datasetLesson.exerciseIds?.length ?? 1) * 8, 8),
            moduleLabel: `Lesson ${String(datasetLesson.order).padStart(2, '0')}`,
            focusScore: datasetLesson.exerciseIds?.length ? 82 : 70,
            vocabulary: [],
            transcript: [],
            injuryCommunication:
              /medical|injury|rehabilitation|fitness/i.test(datasetLesson.title) ||
              datasetLesson.pageStart === 29,
            pageStart: datasetLesson.pageStart,
            pageEnd: datasetLesson.pageEnd,
            exerciseIds: datasetLesson.exerciseIds ?? [],
            sourcePageImages: datasetLesson.sourcePageImages ?? [],
            sourcePdf: datasetLesson.sourcePdf,
            contentMode: datasetLesson.contentMode,
          },
        },
        { upsert: true, new: true },
      );
      lessonIdByExternalId.set(datasetLesson._id, lesson._id as Types.ObjectId);
    }

    for (const datasetExercise of exercisesData) {
      const lessonObjectId = lessonIdByExternalId.get(datasetExercise.lessonId);
      if (!lessonObjectId) continue;

      await this.exerciseModel.findOneAndUpdate(
        { externalId: datasetExercise._id },
        {
          $set: {
            externalId: datasetExercise._id,
            lessonObjectId,
            datasetLessonId: datasetExercise.lessonId,
            lessonTitle: datasetExercise.lessonTitle,
            type: datasetExercise.type,
            title: datasetExercise.title,
            prompt: datasetExercise.prompt,
            questions: datasetExercise.questions ?? [],
            options: datasetExercise.options ?? [],
            answerKey: datasetExercise.answerKey,
            grading: datasetExercise.grading,
            difficulty: datasetExercise.difficulty,
            tags: datasetExercise.tags ?? [],
            assets: datasetExercise.assets ?? [],
            sourcePageImage: datasetExercise.sourcePageImage,
            page: datasetExercise.page,
            isActive: datasetExercise.isActive !== false,
          },
        },
        { upsert: true, new: true },
      );
    }

    await this.seedCuratedImageExercises(lessonIdByExternalId);
    await this.seedCuratedImageExercisesForLegacyEspCourse();

    for (const datasetImage of imagesData) {
      await this.imageModel.findOneAndUpdate(
        { externalId: datasetImage._id },
        {
          $set: {
            externalId: datasetImage._id,
            pageNumber: datasetImage.pageNumber,
            type: datasetImage.type,
            url: datasetImage.url,
            sourcePdf: datasetImage.sourcePdf,
            purpose: datasetImage.purpose,
          },
        },
        { upsert: true },
      );
    }
  }

  private async seedCuratedImageExercises(lessonIdByExternalId: Map<string, Types.ObjectId>) {
    const exercises = this.curatedImageExercises();
    for (const exercise of exercises) {
      const lessonObjectId = lessonIdByExternalId.get(exercise.datasetLessonId);
      if (!lessonObjectId) continue;

      await this.exerciseModel.findOneAndUpdate(
        { externalId: exercise.externalId },
        {
          $set: {
            ...exercise,
            lessonObjectId,
            isActive: true,
          },
        },
        { upsert: true },
      );
    }
  }

  private async seedCuratedImageExercisesForLegacyEspCourse() {
    const legacyCourse = await this.courseModel
      .findOne({ slug: 'english-for-sportive-purposes-odin-esport' })
      .lean();
    if (!legacyCourse) return;

    const lessons = await this.lessonModel.find({ courseId: legacyCourse._id }).lean();
    const lessonByDatasetId = new Map<string, any>();
    for (const lesson of lessons) {
      const title = String(lesson.title ?? '').toLowerCase();
      if (title.includes('introduction to sports english')) {
        lessonByDatasetId.set('lesson_02', lesson);
      }
      if (title.includes('sports events and competitions')) {
        lessonByDatasetId.set('lesson_04', lesson);
      }
      if (title.includes('training routines and fitness plans')) {
        lessonByDatasetId.set('lesson_05', lesson);
      }
    }

    for (const exercise of this.curatedImageExercises()) {
      const lesson = lessonByDatasetId.get(exercise.datasetLessonId);
      if (!lesson) continue;

      await this.exerciseModel.findOneAndUpdate(
        { externalId: `${exercise.externalId}_odin_esport` },
        {
          $set: {
            ...exercise,
            externalId: `${exercise.externalId}_odin_esport`,
            lessonObjectId: lesson._id,
            datasetLessonId: `odin_esport:${exercise.datasetLessonId}`,
            lessonTitle: lesson.title,
            isActive: true,
          },
        },
        { upsert: true },
      );
    }
  }

  private curatedImageExercises() {
    return [
      {
        externalId: 'esp_img_drag_warmup_actions',
        datasetLessonId: 'lesson_02',
        lessonTitle: 'Lesson 1: Introduction to Sports English',
        type: 'matching',
        title: 'Drag and Drop: Warm-up Actions',
        prompt:
          'Drag each action phrase to the correct warm-up image from the ESP worksheet.',
        questions: [],
        options: [],
        answerKey: {
          dragDrop: {
            mode: 'drag_drop',
            instruction: 'Drag each action card onto the matching warm-up image.',
            left: [
              {
                id: '1',
                label: 'Warm-up image 1',
                imageUrl: '/assets/extracted_images/img_p006_04_c1bb275ef2.png',
              },
              {
                id: '2',
                label: 'Warm-up image 2',
                imageUrl: '/assets/extracted_images/img_p006_02_a124241615.png',
              },
              {
                id: '3',
                label: 'Warm-up image 3',
                imageUrl: '/assets/extracted_images/img_p006_03_3455b2faa8.png',
              },
              {
                id: '4',
                label: 'Warm-up image 4',
                imageUrl: '/assets/extracted_images/img_p006_06_7f39148a35.png',
              },
            ],
            right: [
              { id: 'a', label: 'Run sideways' },
              { id: 'b', label: 'Run with your knees high' },
              { id: 'c', label: 'Touch your bottom with your heels' },
              { id: 'd', label: 'Run backwards' },
            ],
            answerMap: {
              '1': 'c',
              '2': 'a',
              '3': 'b',
              '4': 'd',
            },
          },
        },
        grading: { mode: 'auto', points: 4 },
        difficulty: 'A2',
        tags: ['drag-drop', 'warm-up', 'movement vocabulary'],
        assets: [
          {
            type: 'image',
            url: '/assets/extracted_images/img_p006_04_c1bb275ef2.png',
            purpose: 'Touch your bottom with your heels',
          },
          {
            type: 'image',
            url: '/assets/extracted_images/img_p006_02_a124241615.png',
            purpose: 'Run sideways',
          },
          {
            type: 'image',
            url: '/assets/extracted_images/img_p006_03_3455b2faa8.png',
            purpose: 'Run with your knees high',
          },
          {
            type: 'image',
            url: '/assets/extracted_images/img_p006_06_7f39148a35.png',
            purpose: 'Run backwards',
          },
        ],
        sourcePageImage: '/assets/pages/page_006.jpg',
        page: 6,
      },
      {
        externalId: 'esp_img_fill_warmup_actions',
        datasetLessonId: 'lesson_02',
        lessonTitle: 'Lesson 1: Introduction to Sports English',
        type: 'fill_blank',
        title: 'Fill in the Blanks: Warm-up Vocabulary',
        prompt: 'Look at each image and complete the coaching phrase.',
        questions: [],
        options: [],
        answerKey: {
          fillBlanks: [
            {
              id: '1',
              imageUrl: '/assets/extracted_images/img_p006_04_c1bb275ef2.png',
              sentence: 'Touch your ____ with your ____.',
              answers: ['bottom heels', 'bottom with your heels'],
              hint: 'Two body-position words',
            },
            {
              id: '2',
              imageUrl: '/assets/extracted_images/img_p006_02_a124241615.png',
              sentence: 'Run ____.',
              answers: ['sideways'],
              hint: 'Direction',
            },
            {
              id: '3',
              imageUrl: '/assets/extracted_images/img_p006_03_3455b2faa8.png',
              sentence: 'Run with your ____ high.',
              answers: ['knees'],
              hint: 'Body part',
            },
            {
              id: '4',
              imageUrl: '/assets/extracted_images/img_p006_06_7f39148a35.png',
              sentence: 'Run ____.',
              answers: ['backwards', 'backward'],
              hint: 'Opposite of forwards',
            },
          ],
        },
        grading: { mode: 'auto', points: 4 },
        difficulty: 'A2',
        tags: ['fill-blank', 'warm-up', 'coaching commands'],
        assets: [
          {
            type: 'image',
            url: '/assets/extracted_images/img_p006_04_c1bb275ef2.png',
            purpose: 'Fill blank prompt image',
          },
          {
            type: 'image',
            url: '/assets/extracted_images/img_p006_02_a124241615.png',
            purpose: 'Fill blank prompt image',
          },
          {
            type: 'image',
            url: '/assets/extracted_images/img_p006_03_3455b2faa8.png',
            purpose: 'Fill blank prompt image',
          },
          {
            type: 'image',
            url: '/assets/extracted_images/img_p006_06_7f39148a35.png',
            purpose: 'Fill blank prompt image',
          },
        ],
        sourcePageImage: '/assets/pages/page_006.jpg',
        page: 6,
      },
      {
        externalId: 'esp_img_drag_football_actions',
        datasetLessonId: 'lesson_04',
        lessonTitle: 'Lesson 3: Sports Events and Competitions',
        type: 'matching',
        title: 'Drag and Drop: Football Actions',
        prompt:
          'Relie par fleche becomes drag and drop: match each football action image with the correct English verb.',
        questions: [],
        options: [],
        answerKey: {
          dragDrop: {
            mode: 'drag_drop',
            instruction: 'Drag the English action to the correct football image.',
            left: [
              {
                id: '1',
                label: 'Football image 1',
                imageUrl: '/assets/extracted_images/img_p024_02_a941d9a524.png',
              },
              {
                id: '2',
                label: 'Football image 2',
                imageUrl: '/assets/extracted_images/img_p024_05_784e23acbe.png',
              },
              {
                id: '3',
                label: 'Football image 3',
                imageUrl: '/assets/extracted_images/img_p024_07_631bcbf28f.png',
              },
              {
                id: '4',
                label: 'Football image 4',
                imageUrl: '/assets/extracted_images/img_p024_10_6b3122c5dc.png',
              },
              {
                id: '5',
                label: 'Football image 5',
                imageUrl: '/assets/extracted_images/img_p024_11_7c7974d2b9.png',
              },
            ],
            right: [
              { id: 'a', label: 'Shoot' },
              { id: 'b', label: 'Tackle' },
              { id: 'c', label: 'Save the ball' },
              { id: 'd', label: 'Take a free kick' },
              { id: 'e', label: 'Dribble past a defender' },
            ],
            answerMap: {
              '1': 'a',
              '2': 'b',
              '3': 'c',
              '4': 'd',
              '5': 'e',
            },
          },
        },
        grading: { mode: 'auto', points: 5 },
        difficulty: 'B1',
        tags: ['drag-drop', 'football', 'match actions'],
        assets: [
          {
            type: 'image',
            url: '/assets/extracted_images/img_p024_02_a941d9a524.png',
            purpose: 'Shoot',
          },
          {
            type: 'image',
            url: '/assets/extracted_images/img_p024_05_784e23acbe.png',
            purpose: 'Tackle',
          },
          {
            type: 'image',
            url: '/assets/extracted_images/img_p024_07_631bcbf28f.png',
            purpose: 'Save the ball',
          },
          {
            type: 'image',
            url: '/assets/extracted_images/img_p024_10_6b3122c5dc.png',
            purpose: 'Take a free kick',
          },
          {
            type: 'image',
            url: '/assets/extracted_images/img_p024_11_7c7974d2b9.png',
            purpose: 'Dribble past a defender',
          },
        ],
        sourcePageImage: '/assets/pages/page_024.jpg',
        page: 24,
      },
      {
        externalId: 'esp_img_fill_football_actions',
        datasetLessonId: 'lesson_04',
        lessonTitle: 'Lesson 3: Sports Events and Competitions',
        type: 'fill_blank',
        title: 'Fill in the Blanks: Football Actions',
        prompt: 'Use the football images to complete each match report sentence.',
        questions: [],
        options: [],
        answerKey: {
          fillBlanks: [
            {
              id: '1',
              imageUrl: '/assets/extracted_images/img_p024_02_a941d9a524.png',
              sentence: 'The striker takes a ____.',
              answers: ['shot'],
              hint: 'Noun form of shoot',
            },
            {
              id: '2',
              imageUrl: '/assets/extracted_images/img_p024_05_784e23acbe.png',
              sentence: 'The defender makes a sliding ____.',
              answers: ['tackle'],
              hint: 'Defensive action',
            },
            {
              id: '3',
              imageUrl: '/assets/extracted_images/img_p024_07_631bcbf28f.png',
              sentence: 'The goalkeeper ____ the ball.',
              answers: ['saves', 'saved'],
              hint: 'Goalkeeper action',
            },
            {
              id: '4',
              imageUrl: '/assets/extracted_images/img_p024_11_7c7974d2b9.png',
              sentence: 'The winger ____ past the defender.',
              answers: ['dribbles', 'dribbled'],
              hint: 'Moves with the ball',
            },
          ],
        },
        grading: { mode: 'auto', points: 4 },
        difficulty: 'B1',
        tags: ['fill-blank', 'football', 'match report'],
        assets: [
          {
            type: 'image',
            url: '/assets/extracted_images/img_p024_02_a941d9a524.png',
            purpose: 'Shot sentence',
          },
          {
            type: 'image',
            url: '/assets/extracted_images/img_p024_05_784e23acbe.png',
            purpose: 'Tackle sentence',
          },
          {
            type: 'image',
            url: '/assets/extracted_images/img_p024_07_631bcbf28f.png',
            purpose: 'Save sentence',
          },
          {
            type: 'image',
            url: '/assets/extracted_images/img_p024_11_7c7974d2b9.png',
            purpose: 'Dribble sentence',
          },
        ],
        sourcePageImage: '/assets/pages/page_024.jpg',
        page: 24,
      },
      {
        externalId: 'esp_img_drag_matchday_places',
        datasetLessonId: 'lesson_05',
        lessonTitle: 'Lesson 4: Training Routines and Fitness Plans',
        type: 'matching',
        title: 'Drag and Drop: Matchday Places',
        prompt:
          'Match each stadium or matchday image with the correct English place word.',
        questions: [],
        options: [],
        answerKey: {
          dragDrop: {
            mode: 'drag_drop',
            instruction: 'Drag the place word onto the correct matchday image.',
            left: [
              {
                id: '1',
                label: 'Matchday place 1',
                imageUrl: '/assets/extracted_images/img_p036_03_e35a25107f.png',
              },
              {
                id: '2',
                label: 'Matchday place 2',
                imageUrl: '/assets/extracted_images/img_p036_04_da01672a7f.png',
              },
              {
                id: '3',
                label: 'Matchday place 3',
                imageUrl: '/assets/extracted_images/img_p036_05_b1ad46c1fc.png',
              },
              {
                id: '4',
                label: 'Matchday place 4',
                imageUrl: '/assets/extracted_images/img_p036_07_dd5fa14dfa.png',
              },
              {
                id: '5',
                label: 'Matchday place 5',
                imageUrl: '/assets/extracted_images/img_p036_08_1f0fb5d787.png',
              },
              {
                id: '6',
                label: 'Matchday place 6',
                imageUrl: '/assets/extracted_images/img_p036_09_3315bd5c07.png',
              },
            ],
            right: [
              { id: 'a', label: 'Stand' },
              { id: 'b', label: 'Gate' },
              { id: 'c', label: 'Players tunnel' },
              { id: 'd', label: 'Substitutes bench' },
              { id: 'e', label: 'Changing room' },
              { id: 'f', label: 'Scoreboard' },
            ],
            answerMap: {
              '1': 'a',
              '2': 'b',
              '3': 'c',
              '4': 'd',
              '5': 'e',
              '6': 'f',
            },
          },
        },
        grading: { mode: 'auto', points: 6 },
        difficulty: 'A2',
        tags: ['drag-drop', 'stadium', 'matchday'],
        assets: [
          {
            type: 'image',
            url: '/assets/extracted_images/img_p036_03_e35a25107f.png',
            purpose: 'Stand',
          },
          {
            type: 'image',
            url: '/assets/extracted_images/img_p036_04_da01672a7f.png',
            purpose: 'Gate',
          },
          {
            type: 'image',
            url: '/assets/extracted_images/img_p036_05_b1ad46c1fc.png',
            purpose: 'Players tunnel',
          },
          {
            type: 'image',
            url: '/assets/extracted_images/img_p036_07_dd5fa14dfa.png',
            purpose: 'Substitutes bench',
          },
          {
            type: 'image',
            url: '/assets/extracted_images/img_p036_08_1f0fb5d787.png',
            purpose: 'Changing room',
          },
          {
            type: 'image',
            url: '/assets/extracted_images/img_p036_09_3315bd5c07.png',
            purpose: 'Scoreboard',
          },
        ],
        sourcePageImage: '/assets/pages/page_036.jpg',
        page: 36,
      },
      {
        externalId: 'esp_img_fill_matchday_places',
        datasetLessonId: 'lesson_05',
        lessonTitle: 'Lesson 4: Training Routines and Fitness Plans',
        type: 'fill_blank',
        title: 'Fill in the Blanks: Matchday Places',
        prompt: 'Complete the stadium vocabulary using the image clue.',
        questions: [],
        options: [],
        answerKey: {
          fillBlanks: [
            {
              id: '1',
              imageUrl: '/assets/extracted_images/img_p036_03_e35a25107f.png',
              sentence: 'Supporters sit in the ____.',
              answers: ['stand', 'stands'],
              hint: 'Where fans sit',
            },
            {
              id: '2',
              imageUrl: '/assets/extracted_images/img_p036_04_da01672a7f.png',
              sentence: 'Fans enter through the ____.',
              answers: ['gate'],
              hint: 'Entrance',
            },
            {
              id: '3',
              imageUrl: '/assets/extracted_images/img_p036_05_b1ad46c1fc.png',
              sentence: 'Players walk out through the ____.',
              answers: ['tunnel', 'players tunnel', "players' tunnel"],
              hint: 'Path to the pitch',
            },
            {
              id: '4',
              imageUrl: '/assets/extracted_images/img_p036_08_1f0fb5d787.png',
              sentence: 'The kit is prepared in the ____ room.',
              answers: ['changing', 'locker', 'dressing'],
              hint: 'Room before the match',
            },
            {
              id: '5',
              imageUrl: '/assets/extracted_images/img_p036_09_3315bd5c07.png',
              sentence: 'The ____ shows the time and score.',
              answers: ['scoreboard'],
              hint: 'Match information screen',
            },
          ],
        },
        grading: { mode: 'auto', points: 5 },
        difficulty: 'A2',
        tags: ['fill-blank', 'stadium', 'matchday vocabulary'],
        assets: [
          {
            type: 'image',
            url: '/assets/extracted_images/img_p036_03_e35a25107f.png',
            purpose: 'Stand sentence',
          },
          {
            type: 'image',
            url: '/assets/extracted_images/img_p036_04_da01672a7f.png',
            purpose: 'Gate sentence',
          },
          {
            type: 'image',
            url: '/assets/extracted_images/img_p036_05_b1ad46c1fc.png',
            purpose: 'Tunnel sentence',
          },
          {
            type: 'image',
            url: '/assets/extracted_images/img_p036_08_1f0fb5d787.png',
            purpose: 'Changing room sentence',
          },
          {
            type: 'image',
            url: '/assets/extracted_images/img_p036_09_3315bd5c07.png',
            purpose: 'Scoreboard sentence',
          },
        ],
        sourcePageImage: '/assets/pages/page_036.jpg',
        page: 36,
      },
    ];
  }

  private async dropLegacyExerciseIndexes() {
    const legacyIndexes = ['lessonId_1_order_1'];
    for (const indexName of legacyIndexes) {
      try {
        await this.exerciseModel.collection.dropIndex(indexName);
        this.logger.log(`Dropped legacy learning_exercises index: ${indexName}`);
      } catch (error: any) {
        const codeName = error?.codeName ?? error?.message ?? '';
        if (!String(codeName).includes('IndexNotFound')) {
          this.logger.warn(`Could not drop legacy index ${indexName}: ${codeName}`);
        }
      }
    }
  }

  private defaultCourses() {
    return [
      {
        slug: 'sport-english-press-conferences',
        title: 'Sport English: Press Conferences',
        description: 'Master post-match answers, composure, and strategic messaging under media pressure.',
        level: CourseLevel.ELITE,
        type: CourseType.MEDIA,
        recommendedPositions: ['ALL', 'MID', 'ATT'],
        tags: ['communication', 'media', 'interview'],
        estimatedMinutes: 72,
        thumbnailUrl:
          'https://images.unsplash.com/photo-1517649763962-0c623066013b?auto=format&fit=crop&w=1200&q=80',
        badgeName: 'Media Liaison Certification',
        medicalFocus: false,
        order: 1,
        lessons: [
          {
            title: 'Match Interview Simulation',
            content:
              'Practice a confident post-match interview. Focus on short answers, controlled breathing, and phrases that protect the team narrative.',
            videoUrl: 'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4',
            order: 1,
            durationMinutes: 24,
            moduleLabel: 'Module 04',
            focusScore: 92,
            vocabulary: ['composure', 'momentum', 'credit to the team', 'fine margins'],
            transcript: [
              {
                time: '12:10',
                text: 'The key to a successful post-match interview is not just the content of your answers.',
                current: false,
              },
              {
                time: '12:45',
                text: 'Control your breath and heart rate. Notice the interviewer leaning forward before you answer.',
                current: true,
              },
              {
                time: '13:20',
                text: 'Strategic pausing creates authority. Never rush to fill the silence.',
                current: false,
              },
            ],
            quizzes: [
              {
                order: 1,
                question: 'Which phrase keeps the focus on the team after a defeat?',
                options: [
                  'I played well but others made mistakes',
                  'We take responsibility and work together for the next match',
                  'The referee decided everything',
                  'I do not want to answer',
                ],
                correctAnswer: 'We take responsibility and work together for the next match',
                explanation: 'Team-first language protects trust and avoids blaming teammates.',
              },
              {
                order: 2,
                question: 'What should a player do before answering a hostile question?',
                options: ['Pause and breathe', 'Interrupt quickly', 'Laugh at the journalist', 'Walk away immediately'],
                correctAnswer: 'Pause and breathe',
                explanation: 'A short pause improves clarity and composure.',
              },
            ],
          },
          {
            title: 'Handling Difficult Questions',
            content:
              'Learn bridge phrases for controversial topics, tactical criticism, missed chances, and selection pressure.',
            videoUrl: 'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
            order: 2,
            durationMinutes: 18,
            moduleLabel: 'Module 05',
            focusScore: 86,
            vocabulary: ['we stay focused', 'the dressing room', 'accountability', 'next fixture'],
            transcript: [
              {
                time: '04:20',
                text: 'A bridge phrase acknowledges the question without repeating negative language.',
                current: true,
              },
            ],
            quizzes: [
              {
                order: 1,
                question: 'Choose the best bridge phrase after a missed penalty.',
                options: [
                  'I was unlucky and that is all',
                  'The pressure was too much',
                  'I accept it, and my focus is helping the team respond',
                  'No comment',
                ],
                correctAnswer: 'I accept it, and my focus is helping the team respond',
                explanation: 'It accepts responsibility and redirects to collective recovery.',
              },
            ],
          },
        ],
      },
      {
        slug: 'foundation-pitch-basics',
        title: 'Foundation Pitch Basics',
        description: 'Core terminology for training, matchday interaction, and daily communication.',
        level: CourseLevel.B1,
        type: CourseType.FOUNDATION,
        recommendedPositions: ['ALL'],
        tags: ['vocabulary', 'training', 'matchday'],
        estimatedMinutes: 45,
        thumbnailUrl:
          'https://images.unsplash.com/photo-1431324155629-1a6deb1dec8d?auto=format&fit=crop&w=1200&q=80',
        badgeName: 'Pitch Awareness Vocab',
        medicalFocus: false,
        order: 2,
        lessons: [
          {
            title: 'Training Ground Commands',
            content: 'Understand and use short English commands during drills, pressing work, and small-sided games.',
            videoUrl: 'https://storage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
            order: 1,
            durationMinutes: 14,
            moduleLabel: 'Module 01',
            focusScore: 78,
            vocabulary: ['press', 'drop', 'switch', 'hold the line'],
            transcript: [
              {
                time: '03:15',
                text: 'Commands on the pitch must be short, loud, and linked to the next action.',
                current: true,
              },
            ],
            quizzes: [
              {
                order: 1,
                question: 'What does "switch play" mean?',
                options: [
                  'Move the ball to the opposite side',
                  'Stop the match',
                  'Change boots',
                  'Ask for substitution',
                ],
                correctAnswer: 'Move the ball to the opposite side',
                explanation: 'Switching play changes the attack point across the pitch.',
              },
            ],
          },
        ],
      },
      {
        slug: 'advanced-unit-command',
        title: 'Advanced Unit Command',
        description: 'Directive language for defensive coordination, midfield control, and offensive transition.',
        level: CourseLevel.B2,
        type: CourseType.TACTICAL,
        recommendedPositions: ['DEF', 'MID'],
        tags: ['tactical', 'defensive line', 'midfield'],
        estimatedMinutes: 58,
        thumbnailUrl:
          'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?auto=format&fit=crop&w=1200&q=80',
        badgeName: 'Tactical Voice Badge',
        medicalFocus: false,
        order: 3,
        lessons: [
          {
            title: 'Defensive Line Vocabulary',
            content: 'Coordinate depth, pressure, cover, and compactness with precise football English.',
            videoUrl: 'https://storage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
            order: 1,
            durationMinutes: 20,
            moduleLabel: 'Module 02',
            focusScore: 82,
            vocabulary: ['step up', 'cover inside', 'track the runner', 'stay compact'],
            transcript: [
              {
                time: '08:05',
                text: 'A centre-back must combine instruction with timing: step up, hold, drop, squeeze.',
                current: true,
              },
            ],
            quizzes: [
              {
                order: 1,
                question: 'Which command asks the defensive line to move forward together?',
                options: ['Drop', 'Step up', 'Man on', 'Recycle'],
                correctAnswer: 'Step up',
                explanation: 'Step up tells the line to move forward and reduce space.',
              },
            ],
          },
        ],
      },
      {
        slug: 'sports-medicine-injury-communication',
        title: 'Sports Medicine: Injury Communication',
        description: 'Describe pain, injury mechanisms, recovery status, and rehab feedback in professional English.',
        level: CourseLevel.B1,
        type: CourseType.MEDICAL,
        recommendedPositions: ['ALL'],
        tags: ['medical', 'rehab', 'injury communication'],
        estimatedMinutes: 50,
        thumbnailUrl:
          'https://images.unsplash.com/photo-1571019613914-85f342c6a11e?auto=format&fit=crop&w=1200&q=80',
        badgeName: 'Recovery Communication Badge',
        medicalFocus: true,
        order: 4,
        lessons: [
          {
            title: 'Reporting a Hamstring Injury',
            content:
              'Explain recurring pain, strain grades, tightness, and recovery limitations clearly to medical staff.',
            videoUrl: 'https://storage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4',
            order: 1,
            durationMinutes: 16,
            moduleLabel: 'Module 04',
            focusScore: 88,
            vocabulary: ['recurring', 'strain', 'tightness', 'range of motion', 'setback'],
            injuryCommunication: true,
            transcript: [
              {
                time: '05:40',
                text: 'Say where the pain starts, what movement triggers it, and whether it is sharp or dull.',
                current: true,
              },
            ],
            quizzes: [
              {
                order: 1,
                question: 'How do you describe a recurring hamstring injury in a medical report?',
                options: [
                  'Chronic biceps femoris tendinopathy',
                  'Recurrent grade II muscle strain',
                  'Acute posterior thigh contusion',
                  'Repetitive hamstring syndrome',
                ],
                correctAnswer: 'Recurrent grade II muscle strain',
                explanation: 'This phrase is clear, medically useful, and avoids vague wording.',
              },
            ],
          },
          {
            title: 'Physio Dialogue During Recovery',
            content: 'Practice telling the physio what improved, what still hurts, and what happens during load changes.',
            videoUrl: 'https://storage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4',
            order: 2,
            durationMinutes: 15,
            moduleLabel: 'Module 05',
            focusScore: 84,
            vocabulary: ['load tolerance', 'mobility', 'stiffness', 'pain scale'],
            injuryCommunication: true,
            transcript: [
              {
                time: '06:00',
                text: 'Use a pain scale and explain the exact drill that caused discomfort.',
                current: true,
              },
            ],
            quizzes: [
              {
                order: 1,
                question: 'Which sentence gives the physio the clearest recovery feedback?',
                options: [
                  'It hurts sometimes',
                  'I feel strange',
                  'Sprint acceleration caused sharp pain at 7 out of 10',
                  'I am not sure',
                ],
                correctAnswer: 'Sprint acceleration caused sharp pain at 7 out of 10',
                explanation: 'It names the movement, symptom, and intensity.',
              },
            ],
          },
        ],
      },
      {
        slug: 'goalkeeper-command-english',
        title: 'Goalkeeper Command English',
        description: 'Lead the back line with direct, urgent, and accurate English from the penalty area.',
        level: CourseLevel.B2,
        type: CourseType.COMMUNICATION,
        recommendedPositions: ['GK', 'DEF'],
        tags: ['goalkeeper', 'defence', 'commands'],
        estimatedMinutes: 42,
        thumbnailUrl:
          'https://images.unsplash.com/photo-1552318965-6e6be7484ada?auto=format&fit=crop&w=1200&q=80',
        badgeName: 'Back Line Commander',
        medicalFocus: false,
        order: 5,
        lessons: [
          {
            title: 'Box Control Calls',
            content: 'Use clear calls for crosses, second balls, marks, and defensive shape.',
            videoUrl: 'https://storage.googleapis.com/gtv-videos-bucket/sample/SubaruOutbackOnStreetAndDirt.mp4',
            order: 1,
            durationMinutes: 13,
            moduleLabel: 'Module 03',
            focusScore: 80,
            vocabulary: ['keeper', 'away', 'mark up', 'second ball'],
            transcript: [
              {
                time: '02:45',
                text: 'A goalkeeper call must arrive before the defender commits to the action.',
                current: true,
              },
            ],
            quizzes: [
              {
                order: 1,
                question: 'What does "keeper" mean during a cross?',
                options: [
                  'The goalkeeper will claim the ball',
                  'A defender should shoot',
                  'The striker is offside',
                  'The referee stopped play',
                ],
                correctAnswer: 'The goalkeeper will claim the ball',
                explanation: 'It tells defenders to leave the ball for the goalkeeper.',
              },
            ],
          },
        ],
      },
    ];
  }
}
