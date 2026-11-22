import { createZodDto } from '@yikart/common'
import { z } from 'zod'

export const RelayPublishMediaUploadSignVoSchema = z.object({
  id: z.string().describe('官方云资产 ID'),
  path: z.string().describe('对象存储路径'),
  url: z.string().describe('预期公网访问 URL'),
  uploadUrl: z.string().describe('直传 PUT 签名 URL'),
})

export class RelayPublishMediaUploadSignVo extends createZodDto(
  RelayPublishMediaUploadSignVoSchema,
  'RelayPublishMediaUploadSignVo',
) {}

export const RelayPublishMediaConfirmVoSchema = z.object({
  id: z.string().optional().describe('官方云资产 ID'),
  url: z.string().describe('公网访问 URL'),
  path: z.string().optional().describe('对象存储路径'),
})

export class RelayPublishMediaConfirmVo extends createZodDto(
  RelayPublishMediaConfirmVoSchema,
  'RelayPublishMediaConfirmVo',
) {}
