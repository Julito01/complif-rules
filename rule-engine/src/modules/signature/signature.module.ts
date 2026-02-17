import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  Account,
  Faculty,
  SignatureSchema,
  SignerGroup,
  Signer,
  SignatureRule,
  SignatureRequest,
  Signature,
} from './domain';
import { SignatureRequestService, SignatureRuleService } from './application';
import { SignatureRequestController, SignatureRuleController } from './infrastructure';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Account,
      Faculty,
      SignatureSchema,
      SignerGroup,
      Signer,
      SignatureRule,
      SignatureRequest,
      Signature,
    ]),
  ],
  controllers: [SignatureRequestController, SignatureRuleController],
  providers: [SignatureRequestService, SignatureRuleService],
  exports: [SignatureRequestService, SignatureRuleService],
})
export class SignatureModule {}
