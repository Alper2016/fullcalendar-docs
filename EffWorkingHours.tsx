import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Calendar, Clock, Plus, Trash2, Check } from "lucide-react";
import { useState, useEffect, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { UseQueryResult } from "react-query";
import { useConfirmDialog } from "../../../context/confirm-dialog/ConfirmDialogProvider";
import { useCreateWorkingHours } from "../../../hooks/working-hours/useCreateWorkingHours";
import { useDeleteWorkingHour } from "../../../hooks/working-hours/useDeleteWorkingHour";
import { GroupedWorkingHour } from "../../../models/WorkingHours";
import {
  DayHours,
  formatTimeToHHMM,
  WeekdaysPayload,
  WorkingHours as WorkingHoursType,
} from "../../../utils/Utils";
import SlotDuration from "../slot-duration/SlotDuration";

interface EffWorkingHoursProps {
  workingHoursQuery: UseQueryResult<GroupedWorkingHour[]>;
  isFormLoading: boolean;
  setWorkingHours: React.Dispatch<React.SetStateAction<WorkingHoursType>>;
  workingHours: WorkingHoursType;
  selectedView?: string;
}

const EffWorkingHours = ({
  workingHoursQuery,
  isFormLoading,
  setWorkingHours,
  workingHours,
}: EffWorkingHoursProps) => {
  const { t } = useTranslation();
  const { mutateAsync: createWorkingHours } = useCreateWorkingHours();
  const { mutateAsync: deleteWorkingHour } = useDeleteWorkingHour();
  const { showConfirmDialog } = useConfirmDialog();
  const [isProcessingShift, setIsProcessingShift] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const dayNameToNumber: { [key: string]: number } = {
    monday: 0,
    tuesday: 1,
    wednesday: 2,
    thursday: 3,
    friday: 4,
    saturday: 5,
    sunday: 6,
  };

  // Memoized save function to prevent unnecessary re-renders
  const handleSaveWorkingHours = useCallback(async () => {
    console.log("Auto-save triggered"); // Debug log
    
    const originalShiftsMap = new Map<number, Set<string>>();
    if (workingHoursQuery.data) {
      workingHoursQuery.data.forEach((dayData) => {
        const dayShifts = new Set<string>();
        dayData.timeRanges.forEach((range) => {
          const start = formatTimeToHHMM(range.start_time);
          const end = formatTimeToHHMM(range.end_time);
          if (start && end) {
            dayShifts.add(`${start}-${end}`);
          }
        });
        if (dayShifts.size > 0) {
          originalShiftsMap.set(dayData.day_of_week, dayShifts);
        }
      });
    }

    const newOrModifiedWorkingHoursDefinitionsPayload: Array<{
      day_of_week: number;
      start_time: string;
      end_time: string;
    }> = [];
    let formHasValidationErrors = false;

    for (const [dayNameStr, dayData] of Object.entries(workingHours)) {
      const dayNameKey = dayNameStr as keyof WorkingHoursType;
      if (dayData.enabled && dayData.shifts.length > 0) {
        const dayNumber = dayNameToNumber[dayNameKey];
        const originalDayShiftsSet = originalShiftsMap.get(dayNumber);
        const uniqueNewOrModifiedShiftsForDayChecker = new Set<string>();

        for (const shift of dayData.shifts) {
          const baseDateStr = "1970-01-01";
          try {
            if (!shift.start || !shift.end) {
              formHasValidationErrors = true;
              continue;
            }
            const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
            if (!timeRegex.test(shift.start) || !timeRegex.test(shift.end)) {
              formHasValidationErrors = true;
              continue;
            }
            const startDateObj = new Date(`${baseDateStr}T${shift.start}:00`);
            const endDateObj = new Date(`${baseDateStr}T${shift.end}:00`);

            if (isNaN(startDateObj.getTime()) || isNaN(endDateObj.getTime())) {
              formHasValidationErrors = true;
              continue;
            }
            if (endDateObj <= startDateObj) {
              formHasValidationErrors = true;
              continue;
            }
            const currentShiftKey = `${shift.start}-${shift.end}`;
            if (
              !originalDayShiftsSet ||
              !originalDayShiftsSet.has(currentShiftKey)
            ) {
              if (uniqueNewOrModifiedShiftsForDayChecker.has(currentShiftKey)) {
                formHasValidationErrors = true;
                continue;
              }
              uniqueNewOrModifiedShiftsForDayChecker.add(currentShiftKey);

              newOrModifiedWorkingHoursDefinitionsPayload.push({
                day_of_week: dayNumber,
                start_time: startDateObj.toISOString(),
                end_time: endDateObj.toISOString(),
              });
            }
          } catch (e) {
            console.error(
              `Error processing rule ${dayNameKey} shift ${shift.start}-${shift.end}:`,
              e
            );
            formHasValidationErrors = true;
          }
        }
      }
    }

    if (formHasValidationErrors) {
      console.log("Validation errors found, skipping save");
      return;
    }

    if (newOrModifiedWorkingHoursDefinitionsPayload.length === 0) {
      console.log("No changes to save");
      return;
    }

    const newWeekdaysInstancesPayload: WeekdaysPayload = {};
    const repeatDays = 180;
    const processingStartDate = new Date();
    processingStartDate.setHours(0, 0, 0, 0);

    const getLocalHHMMFromISO = (isoString: string): string => {
      const date = new Date(isoString);
      const hours = date.getHours().toString().padStart(2, "0");
      const minutes = date.getMinutes().toString().padStart(2, "0");
      return `${hours}:${minutes}`;
    };

    for (let i = 0; i < repeatDays; i++) {
      const currentDate = new Date(processingStartDate);
      currentDate.setDate(processingStartDate.getDate() + i);
      const currentDateStr = currentDate.toISOString().split("T")[0];

      const currentDayOfWeekJS = currentDate.getDay();
      const dayOfWeekForApi =
        currentDayOfWeekJS === 0 ? 6 : currentDayOfWeekJS - 1;

      const shiftsForThisDayOfWeekInPayload =
        newOrModifiedWorkingHoursDefinitionsPayload.filter(
          (def) => def.day_of_week === dayOfWeekForApi
        );

      if (shiftsForThisDayOfWeekInPayload.length > 0) {
        if (!newWeekdaysInstancesPayload[dayOfWeekForApi]) {
          newWeekdaysInstancesPayload[dayOfWeekForApi] = [];
        }

        for (const definition of shiftsForThisDayOfWeekInPayload) {
          const localStartTimeHHMM = getLocalHHMMFromISO(definition.start_time);
          const localEndTimeHHMM = getLocalHHMMFromISO(definition.end_time);

          if (!localStartTimeHHMM || !localEndTimeHHMM) {
            continue;
          }
          try {
            const instanceStartTime = new Date(
              `${currentDateStr}T${localStartTimeHHMM}:00`
            );
            const instanceEndTime = new Date(
              `${currentDateStr}T${localEndTimeHHMM}:00`
            );

            if (instanceEndTime <= instanceStartTime) continue;

            newWeekdaysInstancesPayload[dayOfWeekForApi].push({
              start_time: instanceStartTime.toISOString(),
              end_time: instanceEndTime.toISOString(),
            });
          } catch (e) {
            console.error(
              `Error parsing instance time for new def ${currentDateStr} shift ${localStartTimeHHMM}-${localEndTimeHHMM}:`,
              e
            );
          }
        }
      }
    }

    try {
      const finalPayload = {
        working_hours: newOrModifiedWorkingHoursDefinitionsPayload,
        weekdays: newWeekdaysInstancesPayload,
      };
      console.log("Saving working hours:", finalPayload); // Debug log
      await createWorkingHours(finalPayload);
      workingHoursQuery.refetch();
      console.log("Working hours saved successfully"); // Debug log
    } catch (error: any) {
      console.error("Error saving working hours:", error);
      if (error?.response?.data) {
        const errors = error.response.data;
        const errorString = JSON.stringify(errors).toLowerCase();
        if (
          errorString.includes("unique constraint") ||
          errorString.includes("duplicate key")
        ) {
          console.error(
            "Error: Database conflict. Ensure the backend handles schedule replacement correctly or that only new items are sent."
          );
        } else {
          const messages = [];
          if (errors.working_hours && Array.isArray(errors.working_hours))
            messages.push(`Rules: ${errors.working_hours.join(", ")}`);
          if (errors.weekdays && Array.isArray(errors.weekdays))
            messages.push(`Instances: ${errors.weekdays.join(", ")}`);
          if (messages.length > 0) {
            console.error(messages.join("; "));
          } else if (errors.detail) {
            console.error(errors.detail);
          } else if (typeof errors === "object") {
            console.error(JSON.stringify(errors));
          } else {
            console.error(String(errors));
          }
        }
      } else if (error.message) {
        console.error(error.message);
      }
    }
  }, [workingHours, workingHoursQuery, createWorkingHours, dayNameToNumber]);

  // Auto-save function with proper debouncing
  const triggerAutoSave = useCallback(() => {
    console.log("triggerAutoSave called"); // Debug log
    
    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    
    // Set saving status immediately
    setSaveStatus('saving');
    
    // Set new timeout for 1 second
    saveTimeoutRef.current = setTimeout(async () => {
      try {
        await handleSaveWorkingHours();
        setSaveStatus('saved');
        // Reset to idle after 2 seconds
        setTimeout(() => setSaveStatus('idle'), 2000);
      } catch (error) {
        console.error("Auto-save failed:", error);
        setSaveStatus('idle');
      }
    }, 1000);
  }, [handleSaveWorkingHours]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  const handleWorkingHoursChange = (
    day: keyof WorkingHoursType,
    field: "enabled" | "shifts",
    value: any,
    idx?: number
  ) => {
    console.log("handleWorkingHoursChange called", { day, field, value, idx }); // Debug log
    
    setWorkingHours((prev) => {
      const dayKey = day as keyof WorkingHoursType;
      const dayData = { ...prev[dayKey] };
      let updatedDayData: DayHours;

      if (field === "enabled") {
        updatedDayData = { ...dayData, enabled: value as boolean };
      } else if (field === "shifts" && typeof idx === "number") {
        const newShifts = [...dayData.shifts];
        const shiftToUpdate = { ...newShifts[idx] };

        if (typeof value === "object" && value !== null) {
          if ("start" in value) shiftToUpdate.start = value.start;
          if ("end" in value) shiftToUpdate.end = value.end;
        }
        newShifts[idx] = shiftToUpdate;
        updatedDayData = { ...dayData, shifts: newShifts };
      } else {
        updatedDayData = { ...dayData };
      }
      return { ...prev, [dayKey]: updatedDayData };
    });
    
    // Trigger auto-save after changes
    triggerAutoSave();
  };

  const addShift = (day: keyof WorkingHoursType) => {
    console.log("addShift called for", day); // Debug log
    
    setWorkingHours((prev) => {
      const dayKey = day as keyof WorkingHoursType;
      if (!prev[dayKey].enabled) {
        const updatedDayData = {
          ...prev[dayKey],
          enabled: true,
          shifts: [{ start: "08:00", end: "16:00" }],
        };
        return { ...prev, [dayKey]: updatedDayData };
      }
      return {
        ...prev,
        [dayKey]: {
          ...prev[dayKey],
          shifts: [...prev[dayKey].shifts, { start: "08:00", end: "16:00" }],
        },
      };
    });
    
    // Trigger auto-save after adding shift
    triggerAutoSave();
  };

  const handleDeleteShift = (
    dayName: keyof WorkingHoursType,
    index: number
  ) => {
    const shiftToDelete = workingHours[dayName]?.shifts[index];
    if (!shiftToDelete) {
      console.error(
        "Could not find shift in form state to delete:",
        dayName,
        index
      );
      return;
    }
    const formStartTime = shiftToDelete.start;
    const formEndTime = shiftToDelete.end;
    const dayNumber = dayNameToNumber[dayName];
    const originalDayData = workingHoursQuery.data?.find(
      (d) => d.day_of_week === dayNumber
    );

    if (!originalDayData) {
      setWorkingHours((prev) => {
        const dayKey = dayName as keyof WorkingHoursType;
        const updatedShifts = prev[dayKey].shifts.filter(
          (_, idx) => idx !== index
        );
        return {
          ...prev,
          [dayKey]: { ...prev[dayKey], shifts: updatedShifts },
        };
      });
      triggerAutoSave();
      return;
    }

    const originalTimeRange = originalDayData.timeRanges.find(
      (range) =>
        formatTimeToHHMM(range.start_time) === formStartTime &&
        formatTimeToHHMM(range.end_time) === formEndTime
    );

    if (
      !originalTimeRange ||
      !originalTimeRange.start_time ||
      !originalTimeRange.end_time
    ) {
      setWorkingHours((prev) => {
        const dayKey = dayName as keyof WorkingHoursType;
        const updatedShifts = prev[dayKey].shifts.filter(
          (_, idx) => idx !== index
        );
        return {
          ...prev,
          [dayKey]: { ...prev[dayKey], shifts: updatedShifts },
        };
      });
      triggerAutoSave();
      return;
    }

    const params = {
      day_of_week: dayNumber,
      start_time: originalTimeRange.start_time,
      end_time: originalTimeRange.end_time,
    };

    showConfirmDialog(
      t("Preferences.workingHours.confirmDeleteShift", {
        dayName: t(`Preferences.workingHours.tableDays.${dayName}`),
        startTime: formStartTime,
        endTime: formEndTime,
      }),
      async () => {
        setIsProcessingShift(true);
        try {
          await deleteWorkingHour(params);
          setWorkingHours((prev) => {
            const dayKey = dayName as keyof WorkingHoursType;
            const updatedShifts = prev[dayKey].shifts.filter(
              (_, idx) => idx !== index
            );
            return {
              ...prev,
              [dayKey]: { ...prev[dayKey], shifts: updatedShifts },
            };
          });
          workingHoursQuery.refetch();
        } catch (error: any) {
          console.error("Error deleting working hour:", error);
        } finally {
          setIsProcessingShift(false);
        }
      }
    );
  };

  return (
    <div className="w-full max-w-full overflow-hidden">
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            {t("Utils.settings.tabviewHeaders.schedule")}
            {saveStatus === 'saving' && (
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-muted-foreground"></div>
                Saving...
              </div>
            )}
            {saveStatus === 'saved' && (
              <div className="flex items-center gap-1 text-sm text-green-600">
                <Check className="h-3 w-3" />
                Saved
              </div>
            )}
          </CardTitle>
          <CardDescription>
            {t("Preferences.workingHours.description")}
          </CardDescription>
        </CardHeader>
        <CardContent className="w-full max-w-full">
          <div className="space-y-6 w-full max-w-full">
            {/* Side by side layout for larger screens */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 w-full max-w-full">
              {/* Time Slot Duration Section */}
              <div className="w-full max-w-full">
                <div className="flex items-center gap-2 mb-4">
                  <Clock className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <h4 className="font-medium text-foreground">
                    {t("Preferences.workingHours.timeSlotDuration")}
                  </h4>
                </div>
                <SlotDuration />
              </div>

              {/* Working Hours Section */}
              <div className="space-y-4 w-full max-w-full">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <h4 className="font-medium text-foreground">
                    {t("Preferences.workingHours.titleWorkingHours")}
                  </h4>
                </div>

                <p className="text-sm text-muted-foreground">
                  {t("Preferences.workingHours.descriptionWorkingHours")}
                </p>

                {isFormLoading && (
                  <div className="space-y-4 w-full max-w-full">
                    {[...Array(3)].map((_, i) => (
                      <div key={i} className="p-3 w-full max-w-full">
                        <div className="flex items-center justify-between mb-3">
                          <Skeleton className="h-5 w-20" />
                          <Skeleton className="h-5 w-10" />
                        </div>
                        <Skeleton className="h-10 w-full" />
                      </div>
                    ))}
                  </div>
                )}

                {!isFormLoading && (
                  <div className="space-y-3 w-full max-w-full max-h-96 overflow-y-auto">
                    {(
                      Object.keys(workingHours) as Array<keyof WorkingHoursType>
                    ).map((day) => {
                      const hours = workingHours[day];
                      const currentDayName = day as keyof WorkingHoursType;
                      const translatedDayName = t(
                        `Preferences.workingHours.tableDays.${currentDayName}`
                      );
                      return (
                        <div
                          key={`edit-${currentDayName}`}
                          className="rounded-lg border border-border transition-colors duration-150 ease-in-out hover:border-border/80 w-full max-w-full"
                        >
                          <div className="flex items-center justify-between gap-2 p-3 pb-2">
                            <label
                              htmlFor={`switch-edit-${currentDayName}`}
                              className="text-sm font-medium capitalize text-foreground flex-1 min-w-0"
                            >
                              {translatedDayName}
                            </label>
                            <Switch
                              id={`switch-edit-${currentDayName}`}
                              checked={hours.enabled}
                              onCheckedChange={(checked) =>
                                handleWorkingHoursChange(
                                  currentDayName,
                                  "enabled",
                                  checked
                                )
                              }
                              className="flex-shrink-0"
                            />
                          </div>

                          {hours.enabled && (
                            <div className="border-t border-border p-3 w-full max-w-full">
                              {hours.shifts.length === 0 && (
                                <p className="text-xs text-muted-foreground italic">
                                  {t("Preferences.workingHours.noShiftsForDay", {
                                    dayName: translatedDayName,
                                  })}
                                </p>
                              )}
                              {hours.shifts.map((shift, idx) => (
                                <div
                                  key={`edit-${currentDayName}-shift-${idx}`}
                                  className="mb-3 last:mb-0 w-full max-w-full"
                                >
                                  <div className="flex sm:items-center">
                                    <div className="flex items-center gap-2 flex-1 min-w-0">
                                      <Input
                                        type="time"
                                        value={shift.start}
                                        onChange={(e) => {
                                          handleWorkingHoursChange(
                                            currentDayName,
                                            "shifts",
                                            { start: e.target.value },
                                            idx
                                          );
                                        }}
                                        className="flex-1 p-1 md:p-3 max-w-[105px] sm:max-w-[120px] text-sm pr-2"
                                        aria-label={t(
                                          "Preferences.workingHours.aria.shiftStartTime",
                                          {
                                            dayName: translatedDayName,
                                            index: idx + 1,
                                          }
                                        )}
                                      />
                                      <span className="text-muted-foreground flex-shrink-0">
                                        -
                                      </span>
                                      <Input
                                        type="time"
                                        value={shift.end}
                                        onChange={(e) => {
                                          handleWorkingHoursChange(
                                            currentDayName,
                                            "shifts",
                                            { end: e.target.value },
                                            idx
                                          );
                                        }}
                                        className="flex-1 p-1 md:p-3 max-w-[105px] sm:max-w-[120px] text-sm"
                                        aria-label={t(
                                          "Preferences.workingHours.aria.shiftEndTime",
                                          {
                                            dayName: translatedDayName,
                                            index: idx + 1,
                                          }
                                        )}
                                      />
                                    </div>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="p-2 h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50 flex-shrink-0 self-end sm:self-center ml-2"
                                      onClick={() =>
                                        handleDeleteShift(currentDayName, idx)
                                      }
                                      disabled={isProcessingShift}
                                      aria-label={t(
                                        "Preferences.workingHours.aria.deleteShift",
                                        {
                                          dayName: translatedDayName,
                                          index: idx + 1,
                                        }
                                      )}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </div>
                              ))}
                              <div className="pt-2 w-full max-w-full">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => addShift(currentDayName)}
                                  disabled={isProcessingShift}
                                  className="text-blue-600 border-blue-200 hover:bg-blue-50 w-full"
                                  aria-label={t(
                                    "Preferences.workingHours.aria.addTimeSlot",
                                    { dayName: translatedDayName }
                                  )}
                                >
                                  <Plus className="h-4 w-4 mr-1 flex-shrink-0" />
                                  {t(
                                    "Preferences.workingHours.addTimeSlotButton"
                                  )}
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default EffWorkingHours;