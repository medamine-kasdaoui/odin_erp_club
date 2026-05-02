import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { GamificationProfile, GamificationProfileDocument } from './schemas/gamification-profile.schema';
import { GamificationAction, GamificationActionDocument } from './schemas/gamification-action.schema';
import { GamificationBadge, GamificationBadgeDocument } from './schemas/gamification-badge.schema';
import { AddActionDto } from './dto/add-action.dto';

@Injectable()
export class GamificationService {
  constructor(
    @InjectModel(GamificationProfile.name) private profileModel: Model<GamificationProfileDocument>,
    @InjectModel(GamificationAction.name) private actionModel: Model<GamificationActionDocument>,
    @InjectModel(GamificationBadge.name) private badgeModel: Model<GamificationBadgeDocument>,
  ) {}

  private calculateLevel(points: number): string {
    if (points >= 8000) return 'Légende';
    if (points >= 3500) return 'Elite';
    if (points >= 1000) return 'Pro';
    return 'Recrue';
  }

  async getProfile(userId: string) {
    let profile = await this.profileModel.findOne({ userId: new Types.ObjectId(userId) });
    if (!profile) {
      profile = await this.profileModel.create({
        userId: new Types.ObjectId(userId),
        totalPoints: 0,
        monthlyPoints: 0,
        currentLevel: 'Recrue',
        activeStreak: 0,
      });
    }

    const actions = await this.actionModel.find({ userId: new Types.ObjectId(userId) }).sort({ createdAt: -1 }).limit(10);
    const badges = await this.badgeModel.find({ userId: new Types.ObjectId(userId) });

    return { profile, recentActions: actions, badges };
  }

  async addAction(dto: AddActionDto) {
    const userObjId = new Types.ObjectId(dto.userId);
    
    // Create the action log
    const action = await this.actionModel.create({
      userId: userObjId,
      actionType: dto.actionType,
      points: dto.points,
      moduleId: dto.moduleId,
      description: dto.description,
    });

    // Find or create profile
    let profile = await this.profileModel.findOne({ userId: userObjId });
    if (!profile) {
      profile = new this.profileModel({
        userId: userObjId,
        totalPoints: 0,
        monthlyPoints: 0,
        currentLevel: 'Recrue',
        activeStreak: 0,
      });
    }

    // Update points
    profile.totalPoints += dto.points;
    profile.monthlyPoints += dto.points;
    profile.currentLevel = this.calculateLevel(profile.totalPoints);
    profile.lastActionDate = new Date();
    
    await profile.save();

    // Logic to check badges could be triggered here based on actionType
    
    return { action, profile };
  }

  async getLeaderboard() {
    // Return top players based on monthlyPoints
    const leaderboard = await this.profileModel.aggregate([
      { $sort: { monthlyPoints: -1 } },
      { $limit: 50 },
      {
        $lookup: {
          from: 'users',
          localField: 'userId',
          foreignField: '_id',
          as: 'user',
        },
      },
      { $unwind: '$user' },
      {
        $project: {
          _id: 1,
          userId: 1,
          totalPoints: 1,
          monthlyPoints: 1,
          currentLevel: 1,
          fullName: '$user.fullName',
          firstName: '$user.firstName',
          lastName: '$user.lastName',
        },
      },
    ]);

    return leaderboard;
  }
}
