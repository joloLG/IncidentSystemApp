import React, { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface FeedbackHistoryProps {
  userId: string;
}

interface UserFeedback {
  id: string;
  feedback_text: string;
  created_at: string;
}

interface FeedbackReply {
  id: string;
  feedback_id: string;
  reply_text: string;
  created_at: string;
  admin_id: string;
}

export function FeedbackHistory({ userId }: FeedbackHistoryProps) {
  const [feedbacks, setFeedbacks] = useState<UserFeedback[]>([]);
  const [replies, setReplies] = useState<FeedbackReply[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchFeedbacks = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("user_feedback")
      .select("id, feedback_text, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (!error && data) setFeedbacks(data);
    setLoading(false);
  }, [userId]);

  const fetchReplies = useCallback(async () => {
    const { data, error } = await supabase
      .from("feedback_replies")
      .select("*")
      .order("created_at", { ascending: true });
    if (!error && data) setReplies(data);
  }, []);

  useEffect(() => {
    fetchFeedbacks();
    fetchReplies();
    const feedbackChannel = supabase
      .channel("user-feedback-history")
      .on("postgres_changes", { event: "*", schema: "public", table: "user_feedback" }, fetchFeedbacks)
      .subscribe();
    const repliesChannel = supabase
      .channel("user-feedback-replies")
      .on("postgres_changes", { event: "*", schema: "public", table: "feedback_replies" }, fetchReplies)
      .subscribe();
    return () => {
      supabase.removeChannel(feedbackChannel);
      supabase.removeChannel(repliesChannel);
    };
  }, [fetchFeedbacks, fetchReplies]);

  return (
    <Card className="my-6">
      <CardHeader>
        <CardTitle>Feedback History</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div>Loading...</div>
        ) : feedbacks.length === 0 ? (
          <div className="text-gray-500">No feedback sent yet.</div>
        ) : (
          <div className="space-y-4">
            {feedbacks.map((fb) => (
              <div key={fb.id} className="border rounded p-3 bg-gray-50">
                <div className="font-semibold text-gray-800 mb-1">You:</div>
                <div className="mb-2 whitespace-pre-wrap">{fb.feedback_text}</div>
                <div className="text-xs text-gray-500 mb-2">Sent: {new Date(fb.created_at).toLocaleString()}</div>
                <div className="ml-4 border-l-2 border-gray-200 pl-4">
                  {replies.filter((r) => r.feedback_id === fb.id).length > 0 ? (
                    <>
                      <div className="font-semibold text-sm text-gray-700 mb-1">Admin Replies:</div>
                      <ul className="space-y-1">
                        {replies
                          .filter((r) => r.feedback_id === fb.id)
                          .map((r) => (
                            <li key={r.id} className="text-sm text-gray-800 bg-gray-100 rounded px-2 py-1">
                              <span className="font-medium text-blue-700">Admin:</span> {r.reply_text}
                              <span className="ml-2 text-xs text-gray-500">{new Date(r.created_at).toLocaleString()}</span>
                            </li>
                          ))}
                      </ul>
                    </>
                  ) : (
                    <div className="text-xs text-gray-400">No reply yet.</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
