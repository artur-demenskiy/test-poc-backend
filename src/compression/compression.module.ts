import { Module, Global } from '@nestjs/common';
import { CompressionService } from './compression.service';

@Global()
@Module({
  providers: [CompressionService],
  exports: [CompressionService],
})
export class CompressionModule {}
