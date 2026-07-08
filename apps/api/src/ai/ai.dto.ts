import { IsOptional, IsString, MinLength } from 'class-validator';

export class GenerateMailDto {
  @IsString()
  @MinLength(1)
  templateKey!: string;

  @IsOptional()
  @IsString()
  tone?: string;
}
