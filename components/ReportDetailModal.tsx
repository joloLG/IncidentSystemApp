"use client"

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface Report {
  id: string;
  emergency_type: string;
  status: string;
  admin_response?: string;
  location_address: string;
  created_at: string;
}

interface ReportDetailModalProps {
  report: Report | null;
  isOpen: boolean;
  onClose: () => void;
}

export function ReportDetailModal({ report, isOpen, onClose }: ReportDetailModalProps) {
  if (!report) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Report Details</DialogTitle>
          <DialogDescription>
            Emergency: {report.emergency_type}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <p><strong>Status:</strong> {report.status}</p>
          <p><strong>Location:</strong> {report.location_address}</p>
          <p><strong>Reported At:</strong> {new Date(report.created_at).toLocaleString()}</p>
          {report.admin_response && <p><strong>Admin Response:</strong> {report.admin_response}</p>}
        </div>
        <div className="mt-4 flex justify-end">
            <Button onClick={onClose}>Close</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
