import { Server as HTTPServer } from "http";
import { Server as SocketIOServer, Socket } from "socket.io";
import jwt from "jsonwebtoken";
import {
  handlePutSingleNotification,
  handlePutBulkNotification,
} from "services/notification.realtime.services";

export class WebSocketManager {
  private io: SocketIOServer;
  private userConnections: Map<number, Set<string>> = new Map();

  constructor(httpServer: HTTPServer) {
    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: process.env.CLIENT_URL || "http://localhost:3000",
        credentials: true,
      },
      transports: ["websocket", "polling"],
    });

    this.setupMiddleware();
    this.setupConnectionHandlers();
  }

  private setupMiddleware() {
    this.io.use((socket: any, next) => {
      const token = socket.handshake.auth.token;
      console.log("token :>> ", token);
      console.log("socket.handshake :>> ", socket.handshake.auth);
      if (!token) {
        return next(new Error("Authentication error"));
      }
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || "") as {
          userId: number;
        };
        socket.userId = decoded.userId;
        next();
      } catch (err) {
        next(new Error("Authentication error"));
      }
    });
  }

  private setupConnectionHandlers() {
    this.io.on("connection", (socket: Socket) => {
      const userId = (socket as any).userId;
      if (!userId) {
        socket.disconnect();
        return;
      }
      // Lưu mapping userId -> socketId
      if (!this.userConnections.has(userId)) {
        this.userConnections.set(userId, new Set());
      }
      this.userConnections.get(userId)!.add(socket.id);

      console.log(`✅ User ${userId} connected with socket ${socket.id}`);

      // Nghe khi client ngắt kết nối
      socket.on("disconnect", () => {
        const connections = this.userConnections.get(userId);
        if (connections) {
          connections.delete(socket.id);
          if (connections.size === 0) {
            this.userConnections.delete(userId);
          }
        }
        console.log(`❌ User ${userId} disconnected from socket ${socket.id}`);
      });

      socket.on("mark_notification_as_read", (notificationId: number) => {
        this.handleMarkAsRead(userId, notificationId);
      });

      socket.on("mark_all_notifications_as_read", () => {
        this.handleMarkAllAsRead(userId);
      });
    });
  }

  /**
   * Gửi thông báo tới user cụ thể (realtime)
   */
  public sendNotificationToUser(
    userId: number,
    notification: {
      id: number;
      type: string;
      title: string;
      content: string;
      priority: string;
      sentAt: Date;
    }
  ) {
    const socketIds = this.userConnections.get(userId);

    if (socketIds && socketIds.size > 0) {
      socketIds.forEach((socketId) => {
        this.io.to(socketId).emit("new_notification", notification);
      });
      console.log(`📢 Sent notification to user ${userId}`);
    }
  }

  /**
   * Gửi thông báo tới nhiều users
   */
  public sendNotificationToUsers(
    userIds: number[],
    notification: {
      id: number;
      type: string;
      title: string;
      content: string;
      priority: string;
      sentAt: Date;
    }
  ) {
    userIds.forEach((userId) => {
      this.sendNotificationToUser(userId, notification);
    });
  }

  public sendUnreadCountUpdate(userId: number, unreadCount: number) {
    const socketIds = this.userConnections.get(userId);

    if (socketIds && socketIds.size > 0) {
      socketIds.forEach((socketId) => {
        this.io
          .to(socketId)
          .emit("unread_count_update", { count: unreadCount });
      });
    }
  }

  private async handleMarkAsRead(userId: number, notificationId: number) {
    try {
      await handlePutSingleNotification(notificationId, userId);
      console.log(
        `📖 Marked notification ${notificationId} as read for user ${userId}`
      );
    } catch (error) {
      console.error("Error marking notification as read:", error);
    }
  }

  private async handleMarkAllAsRead(userId: number) {
    try {
      await handlePutBulkNotification(userId);
      console.log(`📖 Marked all notifications as read for user ${userId}`);
    } catch (error) {
      console.error("Error marking all notifications as read:", error);
    }
  }

  public getIO(): SocketIOServer {
    return this.io;
  }

  public isUserOnline(userId: number): boolean {
    return (
      this.userConnections.has(userId) &&
      this.userConnections.get(userId)!.size > 0
    );
  }

  /**
   * Lấy số lượng connection của user
   */
  public getUserConnectionCount(userId: number): number {
    return this.userConnections.get(userId)?.size || 0;
  }
}

// Singleton instance
let wsManager: WebSocketManager;

export function initializeWebSocket(httpServer: HTTPServer): WebSocketManager {
  if (!wsManager) {
    wsManager = new WebSocketManager(httpServer);
  }
  return wsManager;
}

export function getWebSocketManager(): WebSocketManager {
  if (!wsManager) {
    throw new Error("WebSocket not initialized");
  }
  return wsManager;
}
