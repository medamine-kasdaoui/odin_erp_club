import { BadRequestException } from '@nestjs/common';
import { Types } from 'mongoose';

export const toObjectId = (value: string | undefined | null, label = 'id') => {
  if (!value) {
    throw new BadRequestException(`Missing ${label}`);
  }
  if (!Types.ObjectId.isValid(value)) {
    throw new BadRequestException(`Invalid ${label}`);
  }
  return new Types.ObjectId(value);
};

export const clubIdFromUser = (user: any) => {
  const clubId = user?.clubId;
  if (!clubId) {
    throw new BadRequestException('User is not linked to a club');
  }
  return toObjectId(String(clubId), 'clubId');
};
