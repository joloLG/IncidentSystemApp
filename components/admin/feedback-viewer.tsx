"use client"

import React, { useState, useEffect, useCallback, useMemo } from "react";
interface FeedbackReply {
  id: string;
  feedback_id: string;
  reply_text: string;
  created_at: string;
  admin_id: string;
}
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Mail, ArrowLeft, Star, RefreshCw, Search } from "lucide-react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";


interface UserFeedback {
  id: string;
  user_id: string;
  feedback_text: string;
  created_at: string;
  is_read: boolean;
  userName?: string;
  userEmail?: string;
  category?: string | null;
  rating?: number | null;
}

export function FeedbackViewer() {
  const [userFeedbacks, setUserFeedbacks] = useState<UserFeedback[]>([]);
  const [unreadFeedbackCount, setUnreadFeedbackCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Reply state
  const [replies, setReplies] = useState<FeedbackReply[]>([]);
  const [replyInput, setReplyInput] = useState<{ [feedbackId: string]: string }>({});
  const [replyingId, setReplyingId] = useState<string | null>(null);
  const [sendingReply, setSendingReply] = useState(false);
  const [replyError, setReplyError] = useState<string | null>(null);

  // Function to fetch User Feedback
  const fetchUserFeedbacks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase
        .from('user_feedback')
        .select(` 
          *,
          users!user_feedback_user_id_fkey(firstName, lastName, email)
        `)
        .order('created_at', { ascending: false });

      if (!error && data) {
        const feedbacksWithUsers: UserFeedback[] = data.map((item: any) => ({
          id: item.id,
          user_id: item.user_id,
          feedback_text: item.feedback_text,
          created_at: item.created_at,
          is_read: item.is_read,
          userName: item.users?.firstName ? `${item.users.firstName} ${item.users.lastName || ''}`.trim() : 'Unknown User',
          userEmail: item.users?.email || 'N/A',
          category: item.category || null,
          rating: typeof item.rating === 'number' ? item.rating : (item.rating == null ? null : Number(item.rating)),
        }));
        setUserFeedbacks(feedbacksWithUsers);
        setUnreadFeedbackCount(feedbacksWithUsers.filter(f => !f.is_read).length);
      } else if (error) {
        console.error("Error fetching user feedbacks:", error);
        setError(`Failed to load user feedbacks: ${error.message}`);
      }
    } catch (err: any) {
      console.error("Unexpected error fetching user feedbacks:", err);
      setError(`An unexpected error occurred: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch replies for all feedback
  const fetchReplies = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('feedback_replies')
        .select('*')
        .order('created_at', { ascending: true });
      if (!error && data) {
        setReplies(data);
      }
    } catch (err: any) {
      // Ignore for now
    }
  }, []);

  // Filters and search
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'bug' | 'feature' | 'question' | 'other'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'unread' | 'read'>('all');
  const [query, setQuery] = useState<string>('');

  const filteredFeedbacks = useMemo(() => {
    let list = [...userFeedbacks];
    if (categoryFilter !== 'all') list = list.filter(f => (f.category || 'bug') === categoryFilter);
    if (statusFilter !== 'all') list = list.filter(f => statusFilter === 'unread' ? !f.is_read : f.is_read);
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      list = list.filter(f =>
        (f.userName || '').toLowerCase().includes(q) ||
        (f.userEmail || '').toLowerCase().includes(q) ||
        (f.feedback_text || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [userFeedbacks, categoryFilter, statusFilter, query]);

  // Device info was removed; no UI/state needed

  // Toggle read state
  const handleToggleRead = useCallback(async (feedbackId: string, curr: boolean) => {
    setError(null);
    try {
      const { error } = await supabase
        .from('user_feedback')
        .update({ is_read: !curr })
        .eq('id', feedbackId);
      if (error) throw error;
      fetchUserFeedbacks();
    } catch (err: any) {
      setError(err.message || 'Failed to update read state.');
    }
  }, [fetchUserFeedbacks]);

  useEffect(() => {
    fetchUserFeedbacks();
    fetchReplies();

    // Real-time for user_feedback
    const userFeedbackChannel = supabase
      .channel('user-feedback-viewer-channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_feedback' }, () => {
        fetchUserFeedbacks();
      })
      .subscribe();

    // Real-time for feedback_replies
    const repliesChannel = supabase
      .channel('feedback-replies-channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'feedback_replies' }, () => {
        fetchReplies();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(userFeedbackChannel);
      supabase.removeChannel(repliesChannel);
    };
  }, [fetchUserFeedbacks, fetchReplies]);
  const handleSendReply = async (feedbackId: string) => {
    setSendingReply(true);
    setReplyError(null);
    try {
      const replyText = replyInput[feedbackId]?.trim();
      if (!replyText) {
        setReplyError('Reply cannot be empty.');
        setSendingReply(false);
        return;
      }
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setReplyError('Admin not authenticated.');
        setSendingReply(false);
        return;
      }
      const { error } = await supabase
        .from('feedback_replies')
        .insert({
          feedback_id: feedbackId,
          reply_text: replyText,
          admin_id: user.id,
          created_at: new Date().toISOString(),
        });
      if (error) throw error;
      setReplyInput((prev) => ({ ...prev, [feedbackId]: '' }));
      setReplyingId(null);
    } catch (err: any) {
      setReplyError(err.message || 'Failed to send reply.');
    } finally {
      setSendingReply(false);
    }
  };
  const handleMarkFeedbackAsRead = async (feedbackId: string) => {
    setError(null);
    try {
      const { error } = await supabase
        .from('user_feedback')
        .update({ is_read: true })
        .eq('id', feedbackId);
      if (error) throw error;
      fetchUserFeedbacks(); 
    } catch (error: any) {
      console.error("Error marking feedback as read:", error);
      setError(`Failed to mark feedback as read: ${error.message}. Please check your Supabase RLS policies for 'user_feedback'.`);
    }
  };

  if (loading) {
    return (
      <Card className="shadow-lg h-full lg:col-span-3">
        <CardHeader className="bg-orange-600 text-white flex flex-row justify-between items-center">
          <div className="flex items-center">
            <CardTitle className="flex items-center">
              <Mail className="mr-3" /> User Feedback
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-6 text-center">
          Loading User Feedback...
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-6">
      <div className="flex justify-start mb-4">
        <Button
          variant="outline"
          className="bg-gray-200 hover:bg-gray-300 text-gray-800"
          asChild
        >
          <Link href="/">
            <ArrowLeft className="h-4 w-4 mr-2" /> Back
          </Link>
        </Button>
      </div>
    <Card className="shadow-lg h-full lg:col-span-3">
      <CardHeader className="bg-orange-600 text-white flex flex-row justify-between items-center">
        <div className="flex items-center">
          <CardTitle className="flex items-center">
            <Mail className="mr-3" /> User Feedback
          </CardTitle>
        </div>
        <div className="flex items-center gap-2">
          <Badge className="bg-white/20 text-white">Unread: {unreadFeedbackCount}</Badge>
          <Button variant="ghost" className="text-white" onClick={fetchUserFeedbacks}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-6">
        <div className="mb-4 grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="md:col-span-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by user or text..." className="pl-9" />
            </div>
          </div>
          <div>
            <Select value={categoryFilter} onValueChange={(v: any) => setCategoryFilter(v)}>
              <SelectTrigger className="w-full"><SelectValue placeholder="Category" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                <SelectItem value="bug">Bug</SelectItem>
                <SelectItem value="feature">Feature</SelectItem>
                <SelectItem value="question">Question</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Select value={statusFilter} onValueChange={(v: any) => setStatusFilter(v)}>
              <SelectTrigger className="w-full"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="unread">Unread</SelectItem>
                <SelectItem value="read">Read</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        {error && <p className="text-red-600 text-sm mb-4 text-center">{error}</p>}
        {filteredFeedbacks.length === 0 ? (
          <p className="text-gray-600 text-center py-4">No user feedback received yet.</p>
        ) : (
          <div className="space-y-4">
            {filteredFeedbacks.map((feedback) => (
              <div key={feedback.id} className={`p-4 border rounded-lg shadow-sm ${feedback.is_read ? 'bg-gray-50' : 'bg-red-50 border-red-200'}`}>
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <p className="font-semibold text-gray-900">From: {feedback.userName} ({feedback.userEmail})</p>
                    <p className="text-xs text-gray-500">{new Date(feedback.created_at).toLocaleString()}</p>
                    <div className="mt-1 flex items-center gap-2">
                      {feedback.category && (
                        <Badge className="bg-orange-100 text-orange-800 border border-orange-300 capitalize">{feedback.category}</Badge>
                      )}
                      {typeof feedback.rating === 'number' && feedback.rating > 0 && (
                        <span className="flex items-center">
                          {[1,2,3,4,5].map(n => (
                            <Star key={n} className={n <= (feedback.rating || 0) ? 'w-4 h-4 fill-yellow-400 stroke-yellow-500' : 'w-4 h-4 text-gray-300'} />
                          ))}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" onClick={() => handleToggleRead(feedback.id, feedback.is_read)}>
                      {feedback.is_read ? 'Mark Unread' : 'Mark Read'}
                    </Button>
                  </div>
                </div>
                <p className="text-gray-800 whitespace-pre-wrap">{feedback.feedback_text}</p>
                <div className="mt-3 ml-4 border-l-2 border-gray-200 pl-4">
                  {replies.filter(r => r.feedback_id === feedback.id).length > 0 && (
                    <div className="mb-2">
                      <span className="font-semibold text-sm text-gray-700">Replies:</span>
                      <ul className="mt-1 space-y-1">
                        {replies.filter(r => r.feedback_id === feedback.id).map(r => (
                          <li key={r.id} className="text-sm text-gray-800 bg-gray-100 rounded px-2 py-1">
                            <span className="font-medium text-blue-700">Admin:</span> {r.reply_text}
                            <span className="ml-2 text-xs text-gray-500">{new Date(r.created_at).toLocaleString()}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {replyingId === feedback.id ? (
                    <div className="flex flex-col gap-2 mt-2">
                      <textarea
                        className="border rounded p-2 text-sm"
                        rows={2}
                        value={replyInput[feedback.id] || ''}
                        onChange={e => setReplyInput(prev => ({ ...prev, [feedback.id]: e.target.value }))}
                        placeholder="Type your reply..."
                        disabled={sendingReply}
                      />
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => handleSendReply(feedback.id)} disabled={sendingReply} className="bg-green-600 hover:bg-green-700 text-white">
                          {sendingReply ? 'Sending...' : 'Send'}
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setReplyingId(null)} disabled={sendingReply}>Cancel</Button>
                      </div>
                      {replyError && <span className="text-xs text-red-600">{replyError}</span>}
                    </div>
                  ) : (
                    <Button size="sm" variant="outline" className="mt-2" onClick={() => setReplyingId(feedback.id)}>
                      Reply
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
    </div>
  );
}
