import { Body, Controller, Param, Post, UploadedFile, UseInterceptors } from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { ApiTags } from '@nestjs/swagger'
import { ApiDoc, AppException, ResponseCode } from '@yikart/common'
import { AssetType } from '@yikart/mongodb'
import { memoryStorage } from 'multer'
import { RelayClientService } from './relay-client.service'
import { CreateRelayPublishMediaUploadSignDto } from './relay-publish-media.dto'
import {
  RelayPublishMediaConfirmVo,
  RelayPublishMediaUploadSignVo,
} from './relay-publish-media.vo'

interface RelayUploadSignResult {
  id: string
  path: string
  url: string
  uploadUrl: string
}

interface RelayConfirmResult {
  id?: string
  url?: string
  path?: string
}

@ApiTags('Channels/Relay')
@Controller('/assets/publishMedia')
export class RelayPublishMediaController {
  constructor(
    private readonly relayClientService: RelayClientService,
  ) {}

  @ApiDoc({
    summary: '代理官方云发布素材整包上传',
    description: '浏览器把文件交给本机，由服务端用 Relay API Key 完成官方云 uploadSign → PUT → confirm，避免浏览器直传官方 R2 的 CORS 问题',
    response: RelayPublishMediaConfirmVo,
  })
  @Post('/upload')
  @UseInterceptors(FileInterceptor('file', {
    storage: memoryStorage(),
    limits: { fileSize: 500 * 1024 * 1024 },
  }))
  async uploadFile(
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!this.relayClientService.enabled) {
      throw new AppException(ResponseCode.RelayServerUnavailable)
    }
    if (!file?.buffer?.length) {
      throw new AppException(ResponseCode.ValidationFailed)
    }

    const url = await this.relayClientService.uploadPublishMediaFile({
      filename: file.originalname || `file_${Date.now()}`,
      contentType: file.mimetype || 'application/octet-stream',
      data: file.buffer,
    })

    return RelayPublishMediaConfirmVo.create({
      url,
    })
  }

  @ApiDoc({
    summary: '代理官方云发布素材上传签名',
    description: '使用本机登录态，由服务端持有的 Relay API Key 向官方云申请 publishMedia 上传签名；浏览器再直传 uploadUrl',
    body: CreateRelayPublishMediaUploadSignDto.schema,
    response: RelayPublishMediaUploadSignVo,
  })
  @Post('/uploadSign')
  async createUploadSign(
    @Body() body: CreateRelayPublishMediaUploadSignDto,
  ) {
    if (!this.relayClientService.enabled) {
      throw new AppException(ResponseCode.RelayServerUnavailable)
    }

    const result = await this.relayClientService.post<RelayUploadSignResult>('/assets/uploadSign', {
      filename: body.filename,
      size: body.size,
      type: AssetType.PublishMedia,
    })

    if (!result?.id || !result.uploadUrl || !result.url) {
      throw new AppException(ResponseCode.RelayServerUnavailable)
    }

    return RelayPublishMediaUploadSignVo.create({
      id: result.id,
      path: result.path,
      url: result.url,
      uploadUrl: result.uploadUrl,
    })
  }

  @ApiDoc({
    summary: '代理官方云发布素材上传确认',
    description: '确认官方云直传完成，并返回公网可访问 URL（透传官方 data.url）',
    response: RelayPublishMediaConfirmVo,
  })
  @Post('/:id/confirm')
  async confirmUpload(
    @Param('id') assetId: string,
  ) {
    if (!this.relayClientService.enabled) {
      throw new AppException(ResponseCode.RelayServerUnavailable)
    }

    const result = await this.relayClientService.post<RelayConfirmResult>(
      `/assets/${assetId}/confirm`,
      {},
    )

    if (!result?.url) {
      throw new AppException(ResponseCode.RelayServerUnavailable)
    }

    return RelayPublishMediaConfirmVo.create({
      id: result.id ?? assetId,
      url: result.url,
      path: result.path,
    })
  }
}
