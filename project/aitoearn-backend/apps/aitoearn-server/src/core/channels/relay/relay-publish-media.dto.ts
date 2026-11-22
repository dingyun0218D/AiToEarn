import { createZodDto } from '@yikart/common'
import { z } from 'zod'

const createRelayPublishMediaUploadSignSchema = z.object({
  filename: z.string().describe('文件名（带扩展名）'),
  size: z.number().optional().describe('文件大小（字节）'),
})

export class CreateRelayPublishMediaUploadSignDto extends createZodDto(
  createRelayPublishMediaUploadSignSchema,
  'CreateRelayPublishMediaUploadSignDto',
) {}
