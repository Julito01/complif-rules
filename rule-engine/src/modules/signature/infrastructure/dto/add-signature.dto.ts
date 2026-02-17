import { IsUUID, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AddSignatureDto {
  @ApiProperty({ description: 'Signer UUID' })
  @IsUUID()
  idSigner: string;

  @ApiProperty({ description: 'Signer group UUID the signer belongs to' })
  @IsUUID()
  idGroup: string;

  @ApiPropertyOptional({ description: 'IP address of the signer', example: '192.168.1.1' })
  @IsOptional()
  @IsString()
  ipAddress?: string;

  @ApiPropertyOptional({ description: 'User agent string of the signer' })
  @IsOptional()
  @IsString()
  userAgent?: string;
}
