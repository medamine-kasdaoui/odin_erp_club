import {
    Injectable,
    UnauthorizedException,
    BadRequestException,
    ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../users/users.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { UserRole, UserStatus, UserType } from '../users/entities/user.entity';

@Injectable()
export class AuthService {
    constructor(
        private usersService: UsersService,
        private jwtService: JwtService,
        private configService: ConfigService,
    ) { }

    async register(registerDto: RegisterDto) {
        // Vérifier si l'email existe déjà
        const existingUser = await this.usersService.findByEmail(registerDto.email);
        if (existingUser) {
            throw new ConflictException('Cet email est déjà utilisé');
        }

        // Hash password
        const tempPassword = 'password123'; // Temporary for dev, will be replaced by approval flow
        const hashedPassword = await bcrypt.hash(tempPassword, 10);

        // Create user with status "pending"
        const user = await this.usersService.create({
            email: registerDto.email,
            firstName: registerDto.firstName,
            lastName: registerDto.lastName,
            phone: registerDto.phone,
            role: registerDto.role,
            clubId: registerDto.clubId,
            passwordHash: hashedPassword,
            status: UserStatus.PENDING,
            userType: UserType.VALIDATED,
        });

        // TODO: Récupérer les admins du club et envoyer email de validation
        // const clubAdmins = await this.usersService.findClubAdmins(registerDto.clubId);
        // await this.mailService.sendValidationRequest(clubAdmins, user);

        return {
            success: true,
            message: 'Inscription reçue ! Votre demande est en attente de validation par le club.',
            userId: user.id,
        };
    }

    async login(loginDto: LoginDto) {
        const user = await this.usersService.findByEmail(loginDto.email);

        if (!user) {
            throw new UnauthorizedException('Identifiants incorrects');
        }

        // Vérifier le statut
        if (user.status === UserStatus.PENDING) {
            throw new UnauthorizedException('Votre compte est en attente de validation');
        }

        if (user.status === UserStatus.REJECTED) {
            throw new UnauthorizedException('Votre demande a été refusée');
        }

        if (user.status === UserStatus.SUSPENDED) {
            throw new UnauthorizedException('Votre compte a été suspendu');
        }

        // Vérifier le mot de passe
        const isPasswordValid = await bcrypt.compare(
            loginDto.password,
            user.passwordHash,
        );
        if (!isPasswordValid) {
            throw new UnauthorizedException('Identifiants incorrects');
        }

        // Générer les tokens
        const payload = {
            sub: user.id,
            email: user.email,
            role: user.role,
            clubId: user.clubId,
        };

        const accessToken = this.jwtService.sign(payload);
        const refreshToken = this.jwtService.sign(payload, {
            expiresIn: this.configService.get('JWT_REFRESH_EXPIRES_IN') || '7d',
        });

        // Mettre à jour last_login
        await this.usersService.updateLastLogin(user.id);

        return {
            success: true,
            accessToken,
            refreshToken,
            user: {
                id: user.id,
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName,
                role: user.role,
                clubId: user.clubId,
            },
        };
    }

    async approveUser(userId: string, adminId: string, clubId: string) {
        const user = await this.usersService.findOne(userId, clubId);

        if (user.status !== UserStatus.PENDING) {
            throw new BadRequestException('Cet utilisateur a déjà été traité');
        }

        // Générer de nouveaux identifiants
        const newPassword = this.generatePassword();
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        // Approuver l'utilisateur
        await this.usersService.update(userId, clubId, {
            status: UserStatus.ACTIVE,
            passwordHash: hashedPassword,
            approvedBy: adminId,
            approvedAt: new Date(),
            userType: UserType.VALIDATED,
        });

        // TODO: Envoyer les identifiants par email
        // await this.mailService.sendCredentials(user.email, newPassword);

        return {
            success: true,
            message: 'Utilisateur approuvé et identifiants envoyés',
            credentials: {
                email: user.email,
                password: newPassword, // À retirer en production, seulement pour test
            },
        };
    }

    async rejectUser(userId: string, adminId: string, clubId: string, reason?: string) {
        const user = await this.usersService.findOne(userId, clubId);

        if (user.status !== UserStatus.PENDING) {
            throw new BadRequestException('Utilisateur introuvable ou déjà traité');
        }

        await this.usersService.update(userId, clubId, {
            status: UserStatus.REJECTED,
            approvedBy: adminId,
            approvedAt: new Date(),
        });

        // TODO: Envoyer email de refus
        // await this.mailService.sendRejection(user.email, reason);

        return {
            success: true,
            message: 'Utilisateur rejeté',
        };
    }

    async getProfile(userId: string, clubId: string) {
        const user = await this.usersService.findOne(userId, clubId);

        // Ne pas retourner le mot de passe
        const { passwordHash, ...userProfile } = user;
        return userProfile;
    }

    async getPendingUsers(clubId: string) {
        return this.usersService.findPendingUsers(clubId);
    }

    private generatePassword(): string {
        // Générer un mot de passe sécurisé de 12 caractères
        const password = randomBytes(8).toString('hex').toUpperCase();
        return password.slice(0, 12);
    }
}
