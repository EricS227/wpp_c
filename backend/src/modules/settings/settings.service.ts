import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class SettingsService {
    constructor(private prisma: PrismaService) { }

    async getSettings(companyId: string) {
        const company = await this.prisma.company.findFirst({
            where: { id: companyId },
            select: {
                id: true,
                greetingMessage: true,
                outOfOfficeMessage: true,
                autoAssignEnabled: true,
                businessHoursEnabled: true,
                businessHoursStart: true,
                businessHoursEnd: true,
                businessDays: true,
            }
        });

        if (!company) {
            throw new NotFoundException('Company not found');
        }

        return company;
    }

    async updateSettings(companyId: string, data: any) {
        const company = await this.prisma.company.findFirst({ where: { id: companyId } });
        if (!company) {
            throw new NotFoundException('Company not found');
        }

        return await this.prisma.company.update({
            where: { id: company.id },
            data: {
                greetingMessage: data.greetingMessage,
                outOfOfficeMessage: data.outOfOfficeMessage,
                autoAssignEnabled: data.autoAssignEnabled,
                businessHoursEnabled: data.businessHoursEnabled,
                businessHoursStart: data.businessHoursStart,
                businessHoursEnd: data.businessHoursEnd,
                businessDays: data.businessDays,
            },
            select: {
                id: true,
                greetingMessage: true,
                outOfOfficeMessage: true,
                autoAssignEnabled: true,
                businessHoursEnabled: true,
                businessHoursStart: true,
                businessHoursEnd: true,
                businessDays: true,
            }
        });
    }
}
