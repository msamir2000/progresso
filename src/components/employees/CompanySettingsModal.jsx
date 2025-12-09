
import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Save, Settings } from "lucide-react";
import { CompanySettings } from "@/api/entities";

export default function CompanySettingsModal({ isOpen, onClose }) {
  const [settings, setSettings] = useState(null);
  const [formData, setFormData] = useState({
    holiday_year_start: "",
    employee_pension_contribution_percent: "",
    employer_pension_contribution_percent: "",
  });
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (isOpen) {
      loadSettings();
    }
  }, [isOpen]);

  const loadSettings = async () => {
    setIsLoading(true);
    try {
      const existingSettings = await CompanySettings.list('', 1);
      if (existingSettings.length > 0) {
        const data = existingSettings[0];
        setSettings(data);
        setFormData({
          holiday_year_start: data.holiday_year_start ? new Date(data.holiday_year_start).toISOString().split('T')[0] : "",
          employee_pension_contribution_percent: data.employee_pension_contribution_percent || "",
          employer_pension_contribution_percent: data.employer_pension_contribution_percent || "",
        });
      } else {
        // No settings exist yet, initialize with empty/default values
        setSettings(null);
        setFormData({
            holiday_year_start: "",
            employee_pension_contribution_percent: 5, // Default value
            employer_pension_contribution_percent: 3, // Default value
        });
      }
    } catch (error) {
      console.error("Error loading company settings:", error);
    }
    setIsLoading(false);
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const dataToSave = {
        ...formData,
        employee_pension_contribution_percent: parseFloat(formData.employee_pension_contribution_percent) || 0,
        employer_pension_contribution_percent: parseFloat(formData.employer_pension_contribution_percent) || 0,
        holiday_year_start: formData.holiday_year_start || null,
      };

      if (settings && settings.id) {
        await CompanySettings.update(settings.id, dataToSave);
      } else {
        await CompanySettings.create(dataToSave);
      }
      onClose();
    } catch (error) {
      console.error("Error saving settings:", error);
    }
    setIsSaving(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Company Data
          </DialogTitle>
          <DialogDescription>
            Configure default settings for new employees. These can be overridden individually.
          </DialogDescription>
        </DialogHeader>
        {isLoading ? (
            <div className="flex justify-center items-center h-48">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
        ) : (
            <div className="grid gap-6 py-4">
                <div className="space-y-2">
                    <Label htmlFor="holiday_year_start" className="font-medium">
                        Start of Company's Holiday Year
                    </Label>
                    <Input
                        id="holiday_year_start"
                        type="date"
                        value={formData.holiday_year_start}
                        onChange={(e) => handleInputChange("holiday_year_start", e.target.value)}
                        className="col-span-3"
                    />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="employee_pension_percent" className="font-medium">
                        Employee Pension Contribution %
                    </Label>
                    <Input
                        id="employee_pension_percent"
                        type="number"
                        value={formData.employee_pension_contribution_percent}
                        onChange={(e) => handleInputChange("employee_pension_contribution_percent", e.target.value)}
                        className="col-span-3"
                        placeholder="e.g., 5"
                    />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="employer_pension_percent" className="font-medium">
                        Employer Pension Contribution %
                    </Label>
                    <Input
                        id="employer_pension_percent"
                        type="number"
                        value={formData.employer_pension_contribution_percent}
                        onChange={(e) => handleInputChange("employer_pension_contribution_percent", e.target.value)}
                        className="col-span-3"
                        placeholder="e.g., 3"
                    />
                </div>
            </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={isSaving || isLoading}>
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save Settings
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
