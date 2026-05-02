import {
  IsString, IsEnum, IsDateString, IsOptional,
  IsArray, IsMongoId, ValidateNested, IsNumber,
  IsBoolean, MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';

class RoomDto {
  @IsString() roomNumber: string;
  @IsEnum(['single', 'double', 'suite']) type: string;
  @IsOptional() @IsMongoId() occupant1?: string;
  @IsOptional() @IsMongoId() occupant2?: string;
  @IsOptional() @IsBoolean() isStaffRoom?: boolean;
}

class HotelDto {
  @IsString() @MinLength(2) name: string;
  @IsString() address: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() website?: string;
  @IsOptional() @IsNumber() lat?: number;
  @IsOptional() @IsNumber() lng?: number;
  @IsDateString() checkIn: string;
  @IsDateString() checkOut: string;
  @IsArray() @ValidateNested({ each: true }) @Type(() => RoomDto)
  rooms: RoomDto[];
}

class DepartureDto {
  @IsDateString() at: string;
  @IsString() from: string;
  @IsOptional() @IsNumber() fromLat?: number;
  @IsOptional() @IsNumber() fromLng?: number;
  @IsEnum(['bus', 'flight', 'train', 'car']) mode: string;
  @IsOptional() @IsString() flightNumber?: string;
  @IsOptional() @IsString() terminal?: string;
}

class ReturnDto {
  @IsDateString() at: string;
  @IsOptional() @IsString() from?: string;
  @IsOptional() @IsString() flightNumber?: string;
}

class ParticipantsDto {
  @IsArray() @IsMongoId({ each: true }) players: string[];
  @IsArray() @IsMongoId({ each: true }) staff: string[];
}

export class CreateTravelDto {
  @IsString() clubId: string;
  @IsOptional() @IsMongoId() matchId: string;
  @IsString() destination: string;
  @IsOptional() @IsNumber() destinationLat?: number;
  @IsOptional() @IsNumber() destinationLng?: number;
  @IsEnum(['away', 'home', 'tour']) type: string;
  @ValidateNested() @Type(() => DepartureDto) departure: DepartureDto;
  @ValidateNested() @Type(() => ReturnDto) return: ReturnDto;
  @ValidateNested() @Type(() => HotelDto) hotel: HotelDto;
  @ValidateNested() @Type(() => ParticipantsDto) participants: ParticipantsDto;
  @IsOptional() @IsNumber() budgetEstime?: number;
  @IsOptional() @IsString() notes?: string;
}
