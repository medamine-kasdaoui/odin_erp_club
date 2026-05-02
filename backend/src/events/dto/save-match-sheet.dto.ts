import { IsArray, IsNotEmpty, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class LineupEntryDto {
    @IsString()
    @IsNotEmpty()
    playerId: string;

    @IsString()
    @IsNotEmpty()
    playerName: string;

    @IsString()
    @IsNotEmpty()
    position: string;   // 'GK', 'CB', 'LB', 'CM', 'ST' …

    @IsOptional()
    jerseyNumber?: number;
}

export class SaveMatchSheetDto {
    @IsString()
    @IsNotEmpty()
    formation: string;   // '4-3-3', '4-4-2', '3-5-2' …

    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => LineupEntryDto)
    starters: LineupEntryDto[];   // 11 joueurs

    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => LineupEntryDto)
    subs: LineupEntryDto[];   // remplaçants

    @IsOptional()
    validate?: boolean;   // true = marquer comme validé
}
