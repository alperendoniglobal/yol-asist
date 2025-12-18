import { Request, Response } from 'express';
import { AuthService } from '../services/AuthService';
import { asyncHandler } from '../middlewares/errorHandler';
import { successResponse, errorResponse } from '../utils/response';

export class AuthController {
  private authService: AuthService;

  constructor() {
    this.authService = new AuthService();
  }

  login = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { email, password } = req.body;
    const result = await this.authService.login(email, password);
    successResponse(res, result, 'Login successful');
  });

  register = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const userData = req.body;
    const user = await this.authService.register(userData);
    successResponse(res, user, 'User registered successfully', 201);
  });

  refreshToken = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { refreshToken } = req.body;
    const tokens = await this.authService.refreshToken(refreshToken);
    successResponse(res, tokens, 'Token refreshed successfully');
  });

  logout = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    successResponse(res, null, 'Logout successful');
  });

  me = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      return errorResponse(res, 'User not authenticated', 401);
    }
    const user = await this.authService.getUserById(req.user.id);
    successResponse(res, user, 'User retrieved successfully');
  });

  changePassword = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      return errorResponse(res, 'User not authenticated', 401);
    }
    const { oldPassword, newPassword } = req.body;
    const result = await this.authService.changePassword(req.user.id, oldPassword, newPassword);
    successResponse(res, result, 'Password changed successfully');
  });
}
