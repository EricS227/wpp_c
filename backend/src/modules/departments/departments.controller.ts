import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { DepartmentsService } from './departments.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Role } from '@prisma/client';

@Controller('departments')
@UseGuards(JwtAuthGuard)
export class DepartmentsController {
  constructor(private departmentsService: DepartmentsService) {}

  @Get()
  findAll(@CurrentUser() user: any) {
    return this.departmentsService.findAll(user.companyId);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.departmentsService.findOne(id, user.companyId);
  }

  @Get(':id/agents')
  getAgents(@Param('id') id: string, @CurrentUser() user: any) {
    return this.departmentsService.getAgents(id, user.companyId);
  }

  @Get(':id/queue')
  getQueue(@Param('id') id: string, @CurrentUser() user: any) {
    return this.departmentsService.getQueue(id, user.companyId);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  create(@CurrentUser() user: any, @Body() body: any) {
    return this.departmentsService.create(user.companyId, body);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  update(@Param('id') id: string, @CurrentUser() user: any, @Body() body: any) {
    return this.departmentsService.update(id, user.companyId, body);
  }
}
