import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '@env/environment';
import { timeout } from 'rxjs';
import { DiscussionPage, DiscussionPostResult } from './discussions.service';

export type CommunityCategory = 'matches' | 'play' | 'equipment' | 'terrace';
export interface CommunityTopic { id: number; title: string; category: CommunityCategory; language: 'hr' | 'en';
  createdAt: string; lastActivityAt: string; commentCount?: number; }
export interface CommunityMatch { id: number; title: string | null; commentCount: number; lastActivityAt: string; }
export interface CommunityList<T> { items: T[]; hasMore: boolean; nextAfter: string | null; }
export interface CommunityTopicPage extends DiscussionPage { topic: CommunityTopic; }
@Injectable({ providedIn: 'root' })
export class CommunityService {
  private base = `${environment.apiUrl}/community`;
  constructor(private http: HttpClient) {}
  access() { return this.http.get<{ canModerate: boolean }>(`${this.base}/access`).pipe(timeout(30000)); }
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
  report(id: string, reason: string) { return this.http.post(`${this.base}/comments/${id}/report`, { reason }).pipe(timeout(30000)); }
  hide(id: string, hidden: boolean) { return this.http.post(`${this.base}/comments/${id}/hide`, { hidden }).pipe(timeout(30000)); }
  reports(after?: string) { return this.http.get<{ reports: { id: string; commentId: string; matchTPId: number; reason: string; createdAt: string }[]; hasMore: boolean; nextAfter: string }>(`${this.base}/reports`, { params: after ? { after } : {} }).pipe(timeout(30000)); }
  removeTopic(id: number) { return this.http.delete(`${this.base}/topics/${id}`).pipe(timeout(30000)); }
}
