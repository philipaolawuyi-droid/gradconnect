import { eq, and, desc, asc, sql, or } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, posts, comments, postLikes, commentLikes, connections, notifications, superlatives, superlativeVotes, events, eventRsvps, successStories, successStoryLikes, successStoryComments, conversations, directMessages } from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod", "bio", "school", "profilePhotoKey", "profilePhotoUrl"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.graduationYear !== undefined) {
      values.graduationYear = user.graduationYear;
      updateSet.graduationYear = user.graduationYear;
    }

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function getUserByEmail(email: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getUserById(id: number) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getFeedPosts(limit: number = 20, offset: number = 0) {
  const db = await getDb();
  if (!db) return [];

  return db
    .select()
    .from(posts)
    .orderBy(desc(posts.createdAt))
    .limit(limit)
    .offset(offset);
}

export async function getPostById(id: number) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.select().from(posts).where(eq(posts.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getPostsByUserId(userId: number, limit: number = 20, offset: number = 0) {
  const db = await getDb();
  if (!db) return [];

  return db
    .select()
    .from(posts)
    .where(eq(posts.userId, userId))
    .orderBy(desc(posts.createdAt))
    .limit(limit)
    .offset(offset);
}

export async function createPost(userId: number, content: string, photoKey?: string, photoUrl?: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(posts).values({
    userId,
    content,
    photoKey,
    photoUrl,
  });

  return result;
}

export async function getCommentsByPostId(postId: number) {
  const db = await getDb();
  if (!db) return [];

  return db
    .select()
    .from(comments)
    .where(eq(comments.postId, postId))
    .orderBy(asc(comments.createdAt));
}

export async function createComment(postId: number, userId: number, content: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.insert(comments).values({
    postId,
    userId,
    content,
  });

  // Increment comment count on post
  await db.update(posts).set({
    commentCount: sql`${posts.commentCount} + 1`
  }).where(eq(posts.id, postId));
}

export async function hasUserLikedPost(postId: number, userId: number) {
  const db = await getDb();
  if (!db) return false;

  const result = await db
    .select()
    .from(postLikes)
    .where(and(eq(postLikes.postId, postId), eq(postLikes.userId, userId)))
    .limit(1);

  return result.length > 0;
}

export async function likePost(postId: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Check if already liked
  const existing = await hasUserLikedPost(postId, userId);
  if (existing) return;

  await db.insert(postLikes).values({
    postId,
    userId,
  });

  // Increment like count on post
  await db.update(posts).set({
    likeCount: sql`${posts.likeCount} + 1`
  }).where(eq(posts.id, postId));
}

export async function unlikePost(postId: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Check if user actually liked the post
  const existing = await hasUserLikedPost(postId, userId);
  if (!existing) return; // Already unliked, no-op

  await db.delete(postLikes).where(
    and(eq(postLikes.postId, postId), eq(postLikes.userId, userId))
  );

  // Decrement like count on post, but clamp to 0
  await db.update(posts).set({
    likeCount: sql`GREATEST(${posts.likeCount} - 1, 0)`
  }).where(eq(posts.id, postId));
}

export async function hasUserLikedComment(commentId: number, userId: number) {
  const db = await getDb();
  if (!db) return false;

  const result = await db
    .select()
    .from(commentLikes)
    .where(and(eq(commentLikes.commentId, commentId), eq(commentLikes.userId, userId)))
    .limit(1);

  return result.length > 0;
}

export async function likeComment(commentId: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const existing = await hasUserLikedComment(commentId, userId);
  if (existing) return;

  await db.insert(commentLikes).values({
    commentId,
    userId,
  });

  // Increment like count on comment
  await db.update(comments).set({
    likeCount: sql`${comments.likeCount} + 1`
  }).where(eq(comments.id, commentId));
}

export async function unlikeComment(commentId: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Check if user actually liked the comment
  const existing = await hasUserLikedComment(commentId, userId);
  if (!existing) return; // Already unliked, no-op

  await db.delete(commentLikes).where(
    and(eq(commentLikes.commentId, commentId), eq(commentLikes.userId, userId))
  );

  // Decrement like count on comment, but clamp to 0
  await db.update(comments).set({
    likeCount: sql`GREATEST(${comments.likeCount} - 1, 0)`
  }).where(eq(comments.id, commentId));
}

export async function getConnections(userId: number, status: "accepted" | "pending" = "accepted") {
  const db = await getDb();
  if (!db) return [];

  const rows = await db
    .select()
    .from(connections)
    .where(and(
      or(eq(connections.userId, userId), eq(connections.connectedUserId, userId)),
      eq(connections.status, status),
    ))
    .orderBy(desc(connections.createdAt));

  return rows.map((connection) => ({
    ...connection,
    connectedUserId: connection.userId === userId ? connection.connectedUserId : connection.userId,
    isRequester: connection.userId === userId,
  }));
}

export async function getConnectionStatus(userId: number, targetUserId: number) {
  const db = await getDb();
  if (!db) return null;

  const result = await db
    .select()
    .from(connections)
    .where(or(
      and(eq(connections.userId, userId), eq(connections.connectedUserId, targetUserId)),
      and(eq(connections.userId, targetUserId), eq(connections.connectedUserId, userId)),
    ))
    .orderBy(desc(connections.updatedAt))
    .limit(1);

  return result.length > 0 ? { ...result[0], isRequester: result[0].userId === userId } : null;
}

export async function createConnection(userId: number, targetUserId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.insert(connections).values({
    userId,
    connectedUserId: targetUserId,
    status: "pending",
  });
}

export async function acceptConnection(userId: number, targetUserId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.update(connections).set({
    status: "accepted"
  }).where(
    and(eq(connections.userId, userId), eq(connections.connectedUserId, targetUserId))
  );
}

export async function getOrCreateConversation(userId: number, otherUserId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [userOneId, userTwoId] = [userId, otherUserId].sort((a, b) => a - b);
  const existing = await db.select().from(conversations)
    .where(and(eq(conversations.userOneId, userOneId), eq(conversations.userTwoId, userTwoId)))
    .limit(1);
  if (existing[0]) return existing[0];
  await db.insert(conversations).values({ userOneId, userTwoId });
  const created = await db.select().from(conversations)
    .where(and(eq(conversations.userOneId, userOneId), eq(conversations.userTwoId, userTwoId)))
    .limit(1);
  if (!created[0]) throw new Error("Unable to create conversation");
  return created[0];
}

export async function getConversationsForUser(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(conversations)
    .where(or(eq(conversations.userOneId, userId), eq(conversations.userTwoId, userId)))
    .orderBy(desc(conversations.lastMessageAt), desc(conversations.updatedAt));
}

export async function getConversationById(conversationId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(conversations).where(eq(conversations.id, conversationId)).limit(1);
  return rows[0];
}

export async function getMessages(conversationId: number, limit = 100) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select().from(directMessages)
    .where(eq(directMessages.conversationId, conversationId))
    .orderBy(desc(directMessages.createdAt))
    .limit(limit);
  return rows.reverse();
}

export async function createMessage(conversationId: number, senderId: number, content: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(directMessages).values({ conversationId, senderId, content });
  await db.update(conversations).set({ lastMessageAt: new Date() }).where(eq(conversations.id, conversationId));
}

export async function markConversationRead(conversationId: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const conversation = await getConversationById(conversationId);
  if (!conversation || ![conversation.userOneId, conversation.userTwoId].includes(userId)) return;
  await db.update(directMessages).set({ readAt: new Date() }).where(
    and(eq(directMessages.conversationId, conversationId), sql`${directMessages.senderId} <> ${userId}`)
  );
}

export async function getNotifications(userId: number, limit: number = 20) {
  const db = await getDb();
  if (!db) return [];

  return db
    .select()
    .from(notifications)
    .where(eq(notifications.userId, userId))
    .orderBy(desc(notifications.createdAt))
    .limit(limit);
}

export async function createNotification(userId: number, actorId: number, type: "like" | "comment" | "connection_request" | "connection_accepted", postId?: number, commentId?: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.insert(notifications).values({
    userId,
    actorId,
    type,
    postId,
    commentId,
  });
}

export async function markNotificationAsRead(notificationId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.update(notifications).set({
    isRead: true
  }).where(eq(notifications.id, notificationId));
}

export async function getSuperlatives() {
  const db = await getDb();
  if (!db) return [];

  return db.select().from(superlatives).orderBy(asc(superlatives.id));
}

export async function getSuperlativeVotes(superlativeId: number) {
  const db = await getDb();
  if (!db) return [];

  return db
    .select()
    .from(superlativeVotes)
    .where(eq(superlativeVotes.superlativeId, superlativeId));
}

export async function voteForSuperlative(superlativeId: number, votedForUserId: number, votedByUserId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.insert(superlativeVotes).values({
    superlativeId,
    votedForUserId,
    votedByUserId,
  });
}

export async function searchUsers(query: string, limit: number = 20) {
  const db = await getDb();
  if (!db) return [];

  return db
    .select()
    .from(users)
    .where(
      sql`${users.name} LIKE ${`%${query}%`} OR ${users.school} LIKE ${`%${query}%`}`
    )
    .limit(limit);
}

export async function getUsersByGraduationYear(year: number, limit: number = 20, offset: number = 0) {
  const db = await getDb();
  if (!db) return [];

  return db
    .select()
    .from(users)
    .where(eq(users.graduationYear, year))
    .orderBy(asc(users.name))
    .limit(limit)
    .offset(offset);
}

export async function getUsersBySchool(school: string, limit: number = 20, offset: number = 0) {
  const db = await getDb();
  if (!db) return [];

  return db
    .select()
    .from(users)
    .where(eq(users.school, school))
    .orderBy(asc(users.name))
    .limit(limit)
    .offset(offset);
}

// Event queries
export async function createEvent(data: {
  createdByUserId: number;
  title: string;
  description?: string;
  location?: string;
  eventDate: Date;
  eventEndDate?: Date;
  photoUrl?: string;
  photoKey?: string;
  maxAttendees?: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(events).values({
    createdByUserId: data.createdByUserId,
    title: data.title,
    description: data.description,
    location: data.location,
    eventDate: data.eventDate,
    eventEndDate: data.eventEndDate,
    photoUrl: data.photoUrl,
    photoKey: data.photoKey,
    maxAttendees: data.maxAttendees,
  });
  
  return result;
}

export async function getEvents(limit = 50, offset = 0) {
  const db = await getDb();
  if (!db) return [];
  
  const result = await db
    .select()
    .from(events)
    .orderBy(events.eventDate)
    .limit(limit)
    .offset(offset);
  
  return result;
}

export async function getEventById(eventId: number) {
  const db = await getDb();
  if (!db) return null;
  
  const { eq } = await import("drizzle-orm");
  
  const result = await db
    .select()
    .from(events)
    .where(eq(events.id, eventId))
    .limit(1);
  
  return result[0] || null;
}

export async function rsvpToEvent(eventId: number, userId: number, status: "going" | "interested" | "not_going") {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const { eq, and } = await import("drizzle-orm");
  
  const existing = await db
    .select()
    .from(eventRsvps)
    .where(and(eq(eventRsvps.eventId, eventId), eq(eventRsvps.userId, userId)))
    .limit(1);
  
  if (existing.length > 0) {
    // Update existing RSVP
    await db
      .update(eventRsvps)
      .set({ status })
      .where(and(eq(eventRsvps.eventId, eventId), eq(eventRsvps.userId, userId)));
  } else {
    // Create new RSVP
    await db.insert(eventRsvps).values({
      eventId,
      userId,
      status,
    });
  }
}

export async function getEventAttendees(eventId: number) {
  const db = await getDb();
  if (!db) return [];
  
  const { eq } = await import("drizzle-orm");
  
  const result = await db
    .select({
      id: users.id,
      name: users.name,
      profilePhotoUrl: users.profilePhotoUrl,
      status: eventRsvps.status,
    })
    .from(eventRsvps)
    .innerJoin(users, eq(eventRsvps.userId, users.id))
    .where(eq(eventRsvps.eventId, eventId));
  
  return result;
}

export async function getEventRsvpStatus(eventId: number, userId: number) {
  const db = await getDb();
  if (!db) return null;
  
  const { eq, and } = await import("drizzle-orm");
  
  const result = await db
    .select()
    .from(eventRsvps)
    .where(and(eq(eventRsvps.eventId, eventId), eq(eventRsvps.userId, userId)))
    .limit(1);
  
  return result[0] || null;
}

// Notification for events
export async function createEventNotification(eventId: number, createdByUserId: number) {
  const db = await getDb();
  if (!db) return;
  
  // Get all users except the creator
  const allUsers = await db.select().from(users);
  
  // Create notifications for all other users
  for (const user of allUsers) {
    if (user.id !== createdByUserId) {
      await db.insert(notifications).values({
        userId: user.id,
        actorId: createdByUserId,
        type: "event_created",
        eventId: eventId,
      });
    }
  }
}

export async function updateEvent(eventId: number, data: {
  title?: string;
  description?: string;
  location?: string;
  eventDate?: Date;
  eventEndDate?: Date;
  maxAttendees?: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const { eq } = await import("drizzle-orm");
  
  const updateData: any = {};
  if (data.title !== undefined) updateData.title = data.title;
  if (data.description !== undefined) updateData.description = data.description;
  if (data.location !== undefined) updateData.location = data.location;
  if (data.eventDate !== undefined) updateData.eventDate = data.eventDate;
  if (data.eventEndDate !== undefined) updateData.eventEndDate = data.eventEndDate;
  if (data.maxAttendees !== undefined) updateData.maxAttendees = data.maxAttendees;
  updateData.updatedAt = new Date();
  
  return await db.update(events).set(updateData).where(eq(events.id, eventId));
}

export async function deleteEvent(eventId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const { eq } = await import("drizzle-orm");
  
  // Delete RSVPs first
  await db.delete(eventRsvps).where(eq(eventRsvps.eventId, eventId));
  
  // Delete notifications
  const { notifications } = await import("../drizzle/schema");
  await db.delete(notifications).where(eq(notifications.eventId, eventId));
  
  // Delete event
  return await db.delete(events).where(eq(events.id, eventId));
}

export async function getEventsByUser(userId: number) {
  const db = await getDb();
  if (!db) return [];
  
  const { eq } = await import("drizzle-orm");
  
  return await db.select().from(events).where(eq(events.createdByUserId, userId));
}

export async function searchEvents(query: string) {
  const db = await getDb();
  if (!db) return [];
  
  const { like } = await import("drizzle-orm");
  
  return await db
    .select()
    .from(events)
    .where(like(events.title, `%${query}%`))
    .orderBy(events.eventDate);
}


// Success Stories
export async function createSuccessStory(
  userId: number,
  title: string,
  description: string,
  category: string,
  imageKey?: string,
  imageUrl?: string
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(successStories).values({
    userId,
    title,
    description,
    category,
    imageKey,
    imageUrl,
  });
  
  return result;
}

export async function getSuccessStories(limit: number = 20, offset: number = 0) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return await db
    .select({
      story: successStories,
      author: {
        id: users.id,
        name: users.name,
        profilePhotoUrl: users.profilePhotoUrl,
      },
    })
    .from(successStories)
    .leftJoin(users, eq(successStories.userId, users.id))
    .orderBy(desc(successStories.createdAt))
    .limit(limit)
    .offset(offset);
}

export async function likeSuccessStory(userId: number, storyId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.insert(successStoryLikes).values({ userId, storyId });
  await db
    .update(successStories)
    .set({ likeCount: sql`${successStories.likeCount} + 1` })
    .where(eq(successStories.id, storyId));
}

export async function unlikeSuccessStory(userId: number, storyId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db
    .delete(successStoryLikes)
    .where(and(eq(successStoryLikes.userId, userId), eq(successStoryLikes.storyId, storyId)));
  
  await db
    .update(successStories)
    .set({ likeCount: sql`GREATEST(${successStories.likeCount} - 1, 0)` })
    .where(eq(successStories.id, storyId));
}

export async function commentOnSuccessStory(userId: number, storyId: number, content: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.insert(successStoryComments).values({ userId, storyId, content });
  await db
    .update(successStories)
    .set({ commentCount: sql`${successStories.commentCount} + 1` })
    .where(eq(successStories.id, storyId));
}

export async function getSuccessStoryComments(storyId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return await db
    .select({
      comment: successStoryComments,
      author: {
        id: users.id,
        name: users.name,
        profilePhotoUrl: users.profilePhotoUrl,
      },
    })
    .from(successStoryComments)
    .leftJoin(users, eq(successStoryComments.userId, users.id))
    .where(eq(successStoryComments.storyId, storyId))
    .orderBy(desc(successStoryComments.createdAt));
}

// TODO: add more feature queries here as your schema grows.
