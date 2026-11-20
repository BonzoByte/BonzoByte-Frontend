import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '@env/environment';
import { timeout } from 'rxjs';
import { DiscussionPage, DiscussionPostResult } from './discussions.service';

export type CommunityCategory = 'matches' | 'play' | 'equipment' | 'terrace';
export interface CommunityTopic { id: number; title: string; category: CommunityCategory; language: 'hr' | 'en';
  createdAt: string; lastActivityAt: string; commentCount?: number; pinned?: boolean; }
export interface CommunityMatch { id: number; title: string | null; commentCount: number; lastActivityAt: string; }
export interface CommunityList<T> { items: T[]; hasMore: boolean; nextAfter: string | null; }
export interface CommunityTopicPage extends DiscussionPage { topic: CommunityTopic; }
export interface CommunityEditResult { comment: { id: string; threadId: number; body: string; editedAt: string | null; editVersion: number }; }
export type CommunityScope = 'forum' | 'match';
export interface CommunityCounts { forum: number; match: number; total: number; }
export interface CommunityReport { id: string; scope: CommunityScope; commentId: string; threadId: number; title: string | null;
  reason: string; createdAt: string; resolved: boolean; resolvedAt: string | null;
  comment: { body: string; authorName: string | null; sequence: number | null; deleted: boolean; hidden: boolean; available: boolean }; }
export interface CommunityReportPage extends CommunityList<CommunityReport> { openCounts: CommunityCounts; }
export interface FollowedCommunityTopic { matchTPId: number; title: string | null; category: CommunityCategory; language: string;
  unread: boolean; lastActivityAt: string | null; firstUnreadSequence: number | null; }
export interface CommunityFollowing { unreadCount: number; threads: FollowedCommunityTopic[]; hasMore: boolean; nextAfter: string | null; }
@Injectable({ providedIn: 'root' })
export class CommunityService {
  private base = `${environment.apiUrl}/community`;
  constructor(private http: HttpClient) {}
  access() { return this.http.get<{ canModerate: boolean }>(`${this.base}/access`).pipe(timeout(30000)); }
  following(after?: string, limit = 20) { return this.http.get<CommunityFollowing>(`${this.base}/following`,
    { params: { limit, ...(after ? { after } : {}) } }).pipe(timeout(30000)); }
  follow(id: number, following: boolean) { return this.http.put<{ following: boolean }>(`${this.base}/topics/${id}/follow`, { following }).pipe(timeout(30000)); }
  pin(id: number, pinned: boolean) { return this.http.put<{ topic: CommunityTopic }>(`${this.base}/topics/${id}/pin`, { pinned }).pipe(timeout(30000)); }
  read(id: number, through: number) { return this.http.put<{ readThrough: number }>(`${this.base}/topics/${id}/read`, { through }).pipe(timeout(30000)); }
  moderationSummary() { return this.http.get<CommunityCounts>(`${this.base}/moderation/summary`).pipe(timeout(30000)); }
  moderation(source: 'all' | CommunityScope, status: 'open' | 'resolved' | 'all', after?: string) {
    return this.http.get<CommunityReportPage>(`${this.base}/moderation`, { params: { source, status, ...(after ? { after } : {}) } }).pipe(timeout(30000));
  }
  resolveReport(row: CommunityReport, resolved: boolean) { return this.http.patch(`${this.base}/moderation/${row.scope}/reports/${row.id}`, { resolved }).pipe(timeout(30000)); }
  moderateComment(row: CommunityReport, hidden: boolean) { return this.http.put(`${this.base}/moderation/${row.scope}/comments/${row.commentId}/hide`, { hidden }).pipe(timeout(30000)); }
  topics(category: CommunityCategory, after?: string) {
    let params = new HttpParams().set('category', category);
    if (after) params = params.set('after', after);
    return this.http.get<CommunityList<CommunityTopic>>(`${this.base}/topics`, { params }).pipe(timeout(30000));
  }
  matches(after?: string) { return this.http.get<CommunityList<CommunityMatch>>(`${this.base}/matches`,
    { params: after ? { after } : {} }).pipe(timeout(30000)); }
  page(id: number, after = 0) { return this.http.get<CommunityTopicPage>(`${this.base}/topics/${id}`,
    { params: { after, limit: 20 } }).pipe(timeout(30000)); }
  create(input: { title: string; category: CommunityCategory; language: string; body: string; clientRequestId: string }) {
    return this.http.post<{ topic: CommunityTopic }>(`${this.base}/topics`, input).pipe(timeout(75000));
  }
  post(id: number, body: string, clientRequestId: string, replyToId?: string) {
    return this.http.post<DiscussionPostResult>(`${this.base}/topics/${id}`, { body, clientRequestId, ...(replyToId ? { replyToId } : {}) }).pipe(timeout(75000));
  }
  remove(id: string) { return this.http.delete(`${this.base}/comments/${id}`).pipe(timeout(30000)); }
  edit(id: string, body: string, version: number) { return this.http.patch<CommunityEditResult>(`${this.base}/comments/${id}`, { body, version }).pipe(timeout(30000)); }
  report(id: string, reason: string) { return this.http.post(`${this.base}/comments/${id}/report`, { reason }).pipe(timeout(30000)); }
  hide(id: string, hidden: boolean) { return this.http.post(`${this.base}/comments/${id}/hide`, { hidden }).pipe(timeout(30000)); }
  reports(after?: string) { return this.http.get<{ reports: { id: string; commentId: string; matchTPId: number; reason: string; createdAt: string }[]; hasMore: boolean; nextAfter: string }>(`${this.base}/reports`, { params: after ? { after } : {} }).pipe(timeout(30000)); }
  removeTopic(id: number) { return this.http.delete(`${this.base}/topics/${id}`).pipe(timeout(30000)); }
}
