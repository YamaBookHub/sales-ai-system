import { IsOptional, IsString } from 'class-validator';

export class UnsubscribeDto {
  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  contactId?: string;
}
