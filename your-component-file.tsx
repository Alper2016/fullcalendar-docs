import axios from "axios";
import {
  Calendar as CalendarIcon,
  CheckCircle,
  FileEdit,
  File as FileIcon,
  Images,
  Loader2,
  Plus,
  Save,
  Send,
  Trash2,
  User,
  X,
} from "lucide-react";
import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { format } from "date-fns";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "../../../context/auth/AuthProvider";
import { useNotification } from "../../../context/notification/NotificationProvider";
import { useActiveProviders } from "../../../hooks/applications/useActiveProviders";
import {
  LinkedInOrganization,
  useLinkedInOrganizations,
} from "../../../hooks/smm/useLinkedInOrganizations";
import { useLinkedInPost } from "../../../hooks/smm/useLinkedInPost";
import {
  useDeleteScheduledPost,
  usePostToSocialMedia,
  useSchedulePost,
  useUpdateScheduledPost,
} from "../../../hooks/smm/useSocialMediaPost";
import { usePlatformUtils } from "../../../hooks/usePlatformUtils";
import { ScheduledSocialMediaPostMapped } from "../../../types/socialMediaTypes";
import { LINKEDIN } from "../../../utils/providerConstants";

interface SocialMediaPostFormProps {
  onSuccess?: () => void;
  initialData?: {
    accounts?: string[];
    content?: string;
    scheduledDate?: string;
    mediaUrls?: string[];
    organizations?: string[];
    postType?: "now" | "scheduled";
  };
  // For viewing/editing existing posts
  post?: ScheduledSocialMediaPostMapped | null;
  onHide?: () => void;
}

const EffSocialMediaPostForm: React.FC<SocialMediaPostFormProps> = ({
  onSuccess,
  initialData,
  post,
}) => {
  const [selectedAccount, setSelectedAccount] = useState<string>("");
  const [content, setContent] = useState<string>("");
  const [scheduledDate, setScheduledDate] = useState<Date | null>(null);
  const [uploadedMediaUrls, setUploadedMediaUrls] = useState<string[]>([]);
  const [uploadedMediaMetadata, setUploadedMediaMetadata] = useState<{
    [fileKey: string]: {
      filename: string;
      fullUrl: string;
    };
  }>({});
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [selectedOrganization, setSelectedOrganization] = useState<string>("");
  const [postType, setPostType] = useState<"now" | "scheduled">("now");
  
  // NEW: Track the actual post status for real-time updates
  const [actualPostStatus, setActualPostStatus] = useState<string | null>(null);

  // Track if form has been modified (for update functionality)
  const [hasChanges, setHasChanges] = useState(false);
  const [originalValues, setOriginalValues] = useState<{
    content: string;
    scheduledDate: Date | null;
    mediaUrls: string[];
    organizations: string[];
  } | null>(null);

  const { show } = useNotification();
  const { getTenantBaseUrl } = useAuth();
  const { t } = useTranslation();

  // Platform utilities
  const { isSocialMediaProvider } = usePlatformUtils();

  // LinkedIn utilities
  const {
    postToLinkedIn,
    validateLinkedInContent,
    validateLinkedInOrganization,
    validateLinkedInMedia,
    isLoading: linkedInLoading,
  } = useLinkedInPost({ 
    onSuccess: () => {
      // Update status immediately after successful post
      if (postType === "now") {
        setActualPostStatus("published");
      } else {
        setActualPostStatus("scheduled");
      }
      if (onSuccess) onSuccess();
    }, 
    postType 
  });

  // Get connected accounts
  const { data: activeTokens = [], isLoading: isLoadingAccounts } =
    useActiveProviders();

  // Filter to only show social media accounts
  const socialMediaTokens = activeTokens.filter((token) =>
    isSocialMediaProvider(token.provider || "")
  );

  // Get LinkedIn organizations for selected LinkedIn accounts
  const linkedInAccountIds = selectedAccount.split(",").filter((accountId) => {
    const account = socialMediaTokens.find((token) => token.id === accountId);
    return account?.provider?.toLowerCase() === LINKEDIN;
  });

  // For editing LinkedIn posts, also get the account ID from the post itself
  const linkedInAccountId =
    linkedInAccountIds.length > 0
      ? linkedInAccountIds[0]
      : post && post.platform.toLowerCase() === LINKEDIN
        ? post.account_id
        : undefined;

  const {
    data: linkedInOrganizations = [],
    isLoading: isLoadingOrganizations,
  } = useLinkedInOrganizations(linkedInAccountId);

  // Initialize form data from either initialData or post prop
  useEffect(() => {
    if (post) {
      setSelectedAccount(post.account_id || "");
      setSelectedOrganization(post.organization_urn || "");
      // Map post data to form state
      const content = post.content;
      const scheduledDate = post.scheduled_time
        ? new Date(post.scheduled_time)
        : null;
      const mediaUrls = post.media_urls || [];
      const postType =
        post.status === "scheduled" || post.status === "pending"
          ? "scheduled"
          : "now";

      setContent(content);
      setScheduledDate(scheduledDate);
      setUploadedMediaUrls(mediaUrls);
      setPostType(postType);
      
      // Set the actual post status from the post data
      setActualPostStatus(post.status);

      // For existing posts, create metadata entries (we only have URLs, not original filenames)
      const metadata: {
        [fileKey: string]: { filename: string; fullUrl: string };
      } = {};
      mediaUrls.forEach((url, index) => {
        metadata[url] = {
          filename: url.split("/").pop() || `Media ${index + 1}`,
          fullUrl: url,
        };
      });
      setUploadedMediaMetadata(metadata);

      // Store original values for change detection
      setOriginalValues({
        content,
        scheduledDate,
        mediaUrls,
        organizations: [post.organization_urn || ""],
      });
      setHasChanges(false);
    } else if (initialData) {
      setSelectedAccount(initialData.accounts?.[0] || "");
      setSelectedOrganization(initialData.organizations?.[0] || "");
      const mediaUrls = initialData.mediaUrls || [];
      setContent(initialData.content || "");
      setScheduledDate(
        initialData.scheduledDate ? new Date(initialData.scheduledDate) : null
      );
      setUploadedMediaUrls(mediaUrls);
      setPostType(initialData.postType || "now");
      
      // Reset actual post status for new posts
      setActualPostStatus(null);

      // For initial data, create metadata entries (we only have URLs, not original filenames)
      const metadata: {
        [fileKey: string]: { filename: string; fullUrl: string };
      } = {};
      mediaUrls.forEach((url, index) => {
        metadata[url] = {
          filename: url.split("/").pop() || `Media ${index + 1}`,
          fullUrl: url,
        };
      });
      setUploadedMediaMetadata(metadata);

      setOriginalValues(null);
      setHasChanges(false);
    }
  }, [initialData, post]);

  // Set organization selection when both post and organizations are loaded
  useEffect(() => {
    if (
      post &&
      post.organization_urn &&
      linkedInOrganizations.length > 0 &&
      !isLoadingOrganizations
    ) {
      // Check if the organization URN exists in the loaded organizations
      const orgExists = linkedInOrganizations.some(
        (org) => org.urn === post.organization_urn
      );
      if (orgExists && selectedOrganization.length === 0) {
        setSelectedOrganization(post.organization_urn);
      }
    }
  }, [
    post,
    linkedInOrganizations,
    isLoadingOrganizations,
    selectedOrganization.length,
  ]);

  // Detect changes for update functionality
  useEffect(() => {
    if (post && originalValues) {
      const hasContentChanged = content !== originalValues.content;
      const hasDateChanged =
        scheduledDate?.getTime() !== originalValues.scheduledDate?.getTime();
      const hasMediaChanged =
        JSON.stringify(uploadedMediaUrls) !==
        JSON.stringify(originalValues.mediaUrls);
      const hasOrgChanged =
        JSON.stringify(selectedOrganization) !==
        JSON.stringify(originalValues.organizations);

      setHasChanges(
        hasContentChanged || hasDateChanged || hasMediaChanged || hasOrgChanged
      );
    }
  }, [
    content,
    scheduledDate,
    uploadedMediaUrls,
    selectedOrganization,
    post,
    originalValues,
  ]);

  // Only include active social media accounts
  const accountOptions = socialMediaTokens
    .filter((token) => token.is_active)
    .map((token) => ({
      value: token.id || "",
      label: token.account_email || "",
      platform: token.provider || "",
      email: token.account_email || "",
    }));

  // LinkedIn organization options
  const organizationOptions = linkedInOrganizations.map(
    (org: LinkedInOrganization) => ({
      value: org.urn,
      label: org.name,
    })
  );

  // Mutations for posting
  const postMutation = usePostToSocialMedia({
    onSuccess: () => {
      // Update status immediately after successful post
      setActualPostStatus("published");
      resetForm();
      if (onSuccess) onSuccess();
    }
  });
  
  const scheduleMutation = useSchedulePost({
    onSuccess: () => {
      // Update status immediately after successful schedule
      setActualPostStatus("scheduled");
      resetForm();
      if (onSuccess) onSuccess();
    }
  });
  
  const updateMutation = useUpdateScheduledPost();
  const deleteMutation = useDeleteScheduledPost();

  // Function to upload a single file using presigned URL, now with fetch for S3 upload
  const uploadMediaFile = async (file: File) => {
    setIsUploading(true);
    // Note: With fetch, live progress tracking is not straightforward.
    // The progress will stay at 0 and then jump to 100 on success.
    setUploadProgress(0);

    // This AbortController is used to implement a timeout for the fetch request.
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000); // 60-second timeout

    try {
      // Step 1: Get presigned URL (still using axios for this, which is fine)
      const presignedResponse = await axios.post(
        `${getTenantBaseUrl()}/social-media/upload/presigned-url/`,
        {
          filename: file.name,
          content_type: file.type,
          file_size: file.size,
        }
      );

      const { file_key, full_url, upload_url, upload_fields } =
        presignedResponse.data;

      // Step 2: Prepare the form data for S3
      const formData = new FormData();

      // Add all the fields returned by your backend.
      // The order of these fields isn't critical, but they must all come before the 'file'.
      Object.keys(upload_fields).forEach((key) => {
        formData.append(key, upload_fields[key]);
      });

      // CRITICAL: The 'file' field MUST be the last one added.
      formData.append("file", file);

      // Step 3: Upload to S3 using the fetch API
      const s3Response = await fetch(upload_url, {
        method: "POST",
        body: formData,
        // The AbortController signal connects the timeout to this request.
        signal: controller.signal,
        // Let the browser set the 'Content-Type' header with the correct multipart boundary.
        // Do NOT set it manually.
      });

      // Once the fetch is complete, clear the timeout.
      clearTimeout(timeoutId);

      // fetch considers statuses like 4xx and 5xx as "resolved", not "rejected".
      // We must check the `ok` property (true for statuses 200-299).
      if (s3Response.ok) {
        // A status of 204 No Content is the typical success response for S3 POST uploads.
        // Update progress to 100% on success
        setUploadProgress(100);

        // Step 4: Add file key to uploadedMediaUrls and store metadata
        setUploadedMediaUrls((prevUrls) => [...prevUrls, file_key]);
        setUploadedMediaMetadata((prevMetadata) => ({
          ...prevMetadata,
          [file_key]: {
            filename: file.name,
            fullUrl: full_url,
          },
        }));
      } else {
        // If the upload failed, S3 often returns a detailed XML error message.
        const errorText = await s3Response.text();
        console.error("S3 Upload Failed. Status:", s3Response.status);
        console.error("S3 Error Response:", errorText);
        // Throw an error to be caught by the outer catch block.
        throw new Error(`S3 upload failed: ${s3Response.statusText}`);
      }
    } catch (error: any) {
      // This will catch errors from getting the presigned URL, the S3 upload failing,
      // or the timeout being triggered.
      if (error.name === "AbortError") {
        console.error("Upload timed out.");
      } else {
        console.error("Error during media upload process:", error);
      }

      show({
        severity: "error",
        summary: t("SocialMedia.toast.upload.error.summary", "Upload failed"),
        detail: t(
          "SocialMedia.toast.upload.error.detail",
          "Failed to upload media file."
        ),
      });
    } finally {
      // Always clear the timeout in the finally block to prevent memory leaks.
      clearTimeout(timeoutId);
      setIsUploading(false);
      setUploadProgress(0); // Reset progress for the next upload
    }
  };

  // Handle file selection with LinkedIn restrictions
  const handleFileSelect = (event: { files: File[] }) => {
    const files = event.files;
    if (files && files.length > 0) {
      // Check if any selected account is LinkedIn and restrict to single file
      const hasLinkedIn = linkedInAccountIds.some((accountId) => {
        const account = socialMediaTokens.find(
          (token) => token.id === accountId
        );
        return account?.provider?.toLowerCase() === LINKEDIN;
      });

      if (!validateLinkedInMedia(uploadedMediaUrls, hasLinkedIn)) {
        return;
      }

      if (hasLinkedIn && files.length > 1) {
        show({
          severity: "warn",
          summary: "LinkedIn Restriction",
          detail:
            "LinkedIn posts only support a single media file. Please upload one file at a time.",
        });
        return;
      }

      files.forEach((file: File) => {
        uploadMediaFile(file);
      });
    }
  };

  // Function to remove an uploaded media by its file key
  const handleRemoveMedia = (fileKeyToRemove: string) => {
    setUploadedMediaUrls((prevUrls) =>
      prevUrls.filter((fileKey) => fileKey !== fileKeyToRemove)
    );
    setUploadedMediaMetadata((prevMetadata) => {
      const newMetadata = { ...prevMetadata };
      delete newMetadata[fileKeyToRemove];
      return newMetadata;
    });
  };

  const handlePost = async () => {
    if (!selectedAccount || !content) return;

    // Check LinkedIn organization requirement
    const linkedInAccounts = linkedInAccountIds.filter((accountId) => {
      const account = socialMediaTokens.find((token) => token.id === accountId);
      return account?.provider?.toLowerCase() === LINKEDIN;
    });

    if (
      linkedInAccounts.length > 0 &&
      !validateLinkedInOrganization([selectedOrganization])
    ) {
      return;
    }

    try {
      // Post to each selected account
      for (const accountId of linkedInAccountIds) {
        const selectedAccountData = socialMediaTokens.find(
          (token) => token.id === accountId
        );

        const postData = {
          account_id: accountId,
          content,
          media_urls: uploadedMediaUrls,
          ...(scheduledDate &&
            postType === "scheduled" && {
              scheduled_time: scheduledDate.toISOString(),
            }),
        };

        // Handle LinkedIn posting
        if (
          selectedAccountData?.provider?.toLowerCase() === LINKEDIN &&
          selectedOrganization.length > 0
        ) {
          await postToLinkedIn(
            accountId,
            content,
            uploadedMediaUrls,
            selectedOrganization,
            scheduledDate || undefined,
            postType
          );
        } else {
          // For non-LinkedIn accounts, use the correct hook based on post type
          if (postType === "scheduled") {
            await scheduleMutation.mutateAsync(postData);
          } else {
            await postMutation.mutateAsync(postData);
          }
        }
      }

      // The status update and form reset is now handled in the mutation success callbacks
    } catch (error) {
      console.error("Error posting:", error);
      show({
        severity: "error",
        summary: t("SocialMedia.toast.post.error.summary", "Post failed"),
        detail: t(
          "SocialMedia.toast.post.error.detail",
          "Failed to post content to social media"
        ),
      });
    }
  };

  const handleUpdate = async () => {
    if (!post || !hasChanges) return;

    try {
      const updateData = {
        content,
        ...(scheduledDate && { scheduled_time: scheduledDate.toISOString() }),
        media_urls: uploadedMediaUrls,
        ...(selectedOrganization.length > 0 && {
          organization_urn: selectedOrganization,
        }),
      };

      await updateMutation.mutateAsync({
        postId: post.id.toString(),
        updateData,
      });

      // Update original values after successful update
      setOriginalValues({
        content,
        scheduledDate,
        mediaUrls: uploadedMediaUrls,
        organizations: [selectedOrganization],
      });
      setHasChanges(false);

      if (onSuccess) onSuccess();
      // Success notification is handled by the mutation hook
    } catch (error) {
      console.error("Error updating post:", error);
      show({
        severity: "error",
        summary: t("SocialMedia.toast.update.error.summary", "Update failed"),
        detail: t(
          "SocialMedia.toast.update.error.detail",
          "Failed to update the post"
        ),
      });
    }
  };

  const handleDelete = async () => {
    if (!post) return;

    try {
      await deleteMutation.mutateAsync(post.id.toString());
      if (onSuccess) onSuccess();
    } catch (error) {
      console.error("Error deleting post:", error);
      show({
        severity: "error",
        summary: t("SocialMedia.toast.delete.error.summary", "Delete failed"),
        detail: t(
          "SocialMedia.toast.delete.error.detail",
          "Failed to delete the post"
        ),
      });
    }
  };

  const resetForm = () => {
    setSelectedAccount("");
    setContent("");
    setScheduledDate(null);
    setUploadedMediaUrls([]);
    setUploadedMediaMetadata({});
    setSelectedOrganization("");
    setPostType("now");
    setActualPostStatus(null); // Reset status
  };

  const characterLimit = 280;
  const characterCount = content.length;
  const isOverLimit = characterCount > characterLimit;

  const linkedInValidation = validateLinkedInContent(content);
  const hasLinkedInAccount = linkedInAccountIds.some((accountId) => {
    const account = socialMediaTokens.find((token) => token.id === accountId);
    return account?.provider?.toLowerCase() === LINKEDIN;
  });

  // Determine read-only state
  const isReadOnly = post && post.status === "published";
  const canEdit =
    post && (post.status === "scheduled" || post.status === "pending");

  // Determine if Post button should be disabled
  const isPostButtonDisabled =
    !selectedAccount ||
    !content ||
    (hasLinkedInAccount && selectedOrganization.length === 0) ||
    (postType === "scheduled" &&
      (!scheduledDate ||
        (scheduledDate.getHours() === 0 &&
          scheduledDate.getMinutes() === 0))) ||
    (hasLinkedInAccount && !linkedInValidation.isValid);

  // Helper function to get status display - now uses actualPostStatus when available
  const getStatusDisplay = (status: string) => {
    const configs = {
      published: {
        label: "Published",
        color: "#10B981",
        icon: "pi-check-circle",
      },
      scheduled: { label: "Scheduled", color: "#F59E0B", icon: "pi-clock" },
      pending: { label: "Pending", color: "#F59E0B", icon: "pi-clock" },
      failed: {
        label: "Failed",
        color: "#EF4444",
        icon: "pi-exclamation-triangle",
      },
    };
    return (
      configs[status as keyof typeof configs] || {
        label: "Draft",
        color: "#6366F1",
        icon: "pi-info-circle",
      }
    );
  };

  const [showDateTimeInputs, setShowDateTimeInputs] = useState<boolean>(false);
  useEffect(() => {
    if (post?.scheduled_time) {
      setShowDateTimeInputs(false);
    } else {
      setShowDateTimeInputs(false);
    }
  }, [post?.scheduled_time]);

  useEffect(() => {
    if (postType === "scheduled" && !scheduledDate && !post) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      setScheduledDate(today);
    }
  }, [postType, scheduledDate, post]);
  
  // Determine which status to show - use actualPostStatus if available, otherwise use post.status
  const displayStatus = actualPostStatus || (post ? post.status : null);
  
  return (
    <div className="flex flex-col h-full max-h-full overflow-hidden">
      {/* Scrollable Form Content */}
      <div className="flex-1 overflow-y-auto hide-scrollbar px-6 py-6">
        <div className="space-y-6">
          {/* Post Status with Platform Badge (for view/edit modes) */}
          {(post || actualPostStatus) && (
            <div className="flex items-center gap-2 mb-4">
              <Badge variant="outline">
                {getStatusDisplay(displayStatus || "draft").label}
              </Badge>
              <Badge variant="outline">{post?.platform || "Social Media"}</Badge>
            </div>
          )}

          {/* Account Selection */}
          <div className="space-y-2">
            <Label htmlFor="accounts" className="flex items-center gap-2">
              <User className="h-4 w-4 text-primary" />
              {t("SocialMedia.form.selectAccountsRequired", "Select Account *")}
            </Label>
            <Select
              value={selectedAccount}
              onValueChange={setSelectedAccount}
              disabled={
                isReadOnly ||
                isLoadingAccounts ||
                postMutation.isLoading ||
                scheduleMutation.isLoading ||
                linkedInLoading ||
                isUploading
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue
                  placeholder={t(
                    "SocialMedia.form.accountsPlaceholder",
                    "Choose social media account"
                  )}
                />
              </SelectTrigger>
              <SelectContent>
                {accountOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {accountOptions.length === 0 && (
              <div className="p-2 bg-yellow-100 text-yellow-800 border border-yellow-200 rounded-md mt-2">
                {t(
                  "SocialMedia.form.noAccountsMessage",
                  "No connected accounts found. Please connect an account first."
                )}
              </div>
            )}
          </div>

          {/* LinkedIn Organization Selection */}
          {hasLinkedInAccount && (
            <div className="space-y-2">
              <Label
                htmlFor="organizations"
                className="flex items-center gap-2"
              >
                <User className="h-4 w-4 text-primary" />
                {t(
                  "SocialMedia.form.selectOrganizationRequired",
                  "LinkedIn Organization *"
                )}
              </Label>
              <Select
                value={selectedOrganization}
                onValueChange={setSelectedOrganization}
                disabled={isReadOnly || isLoadingOrganizations}
              >
                <SelectTrigger className="w-full">
                  <SelectValue
                    placeholder={
                      isLoadingOrganizations
                        ? t(
                            "SocialMedia.form.organizationLoadingPlaceholder",
                            "Loading organizations..."
                          )
                        : t(
                            "SocialMedia.form.organizationPlaceholder",
                            "Select organization"
                          )
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {organizationOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Post Type Selection - only show for new posts */}
          {!post && !actualPostStatus && (
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <CalendarIcon className="h-4 w-4 text-primary" />
                {t("SocialMedia.form.postType.label", "When to Post")}
              </Label>
              <div className="flex gap-2">
                <div
                  className={`p-2 border-2 rounded-lg cursor-pointer transition-colors flex-1 ${
                    postType === "now"
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-muted hover:border-primary/40"
                  }`}
                  onClick={() => setPostType("now")}
                >
                  <div className="flex items-center justify-center gap-2">
                    <Send className="h-4 w-4" />
                    <span className="font-medium">
                      {t("SocialMedia.form.postType.now", "Post Now")}
                    </span>
                  </div>
                </div>
                <div
                  className={`p-2 border-2 rounded-lg cursor-pointer transition-colors flex-1 ${
                    postType === "scheduled"
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-muted hover:border-primary/40"
                  }`}
                  onClick={() => setPostType("scheduled")}
                >
                  <div className="flex items-center justify-center gap-2">
                    <CalendarIcon className="h-4 w-4" />
                    <span className="font-medium">
                      {t("SocialMedia.form.postType.schedule", "Schedule")}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Schedule Date/Time */}
          {(postType === "scheduled" || post?.scheduled_time) && (
            <div className="space-y-2">
              <Label
                htmlFor="scheduledDate"
                className="flex items-center gap-2"
              >
                <CalendarIcon className="h-4 w-4 text-primary" />
                {t(
                  "SocialMedia.form.scheduledDate.labelRequired",
                  "Schedule Date & Time *"
                )}
              </Label>

              {!showDateTimeInputs ? (
                <div
                  className="rounded border px-4 py-2 bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors text-sm"
                  onClick={() => setShowDateTimeInputs(true)}
                  tabIndex={0}
                  role="button"
                  aria-label="Edit date and time"
                >
                  {scheduledDate
                    ? format(scheduledDate, "PPP") +
                      (scheduledDate.getHours() === 0 &&
                      scheduledDate.getMinutes() === 0
                        ? ""
                        : ` at ${format(scheduledDate, "p")}`)
                    : format(new Date(), "PPP") + ""}
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex gap-3">
                    <div className="flex-1">
                      <Label htmlFor="schedule-date" className="text-sm">
                        Date
                      </Label>
                      <Input
                        id="schedule-date"
                        type="date"
                        value={
                          scheduledDate
                            ? format(scheduledDate, "yyyy-MM-dd")
                            : format(new Date(), "yyyy-MM-dd")
                        }
                        onChange={(e) => {
                          const newDate = new Date(e.target.value);
                          const existingTime = scheduledDate
                            ? scheduledDate
                            : new Date();
                          newDate.setHours(
                            existingTime.getHours(),
                            existingTime.getMinutes()
                          );
                          setScheduledDate(newDate);
                        }}
                        className="w-full"
                      />
                    </div>
                    <div className="flex-1">
                      <Label htmlFor="schedule-time" className="text-sm">
                        Time
                      </Label>
                      <Input
                        id="schedule-time"
                        type="time"
                        value={
                          scheduledDate && scheduledDate.getHours() !== 0
                            ? format(scheduledDate, "HH:mm")
                            : ""
                        }
                        onChange={(e) => {
                          const [hours, minutes] = e.target.value.split(":");
                          const newDateTime = scheduledDate
                            ? new Date(scheduledDate)
                            : new Date();
                          newDateTime.setHours(
                            parseInt(hours),
                            parseInt(minutes)
                          );
                          setScheduledDate(newDateTime);
                        }}
                        className="w-full"
                        placeholder="Select time *"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Content */}
          <div className="space-y-2">
            <Label htmlFor="content" className="flex items-center gap-2">
              <FileEdit className="h-4 w-4 text-primary" />
              {t("SocialMedia.form.content.labelRequired", "Content *")}
            </Label>
            <Textarea
              id="content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={6}
              className={`w-full ${isOverLimit ? "border-destructive" : ""}`}
              disabled={
                isReadOnly ||
                postMutation.isLoading ||
                scheduleMutation.isLoading ||
                linkedInLoading ||
                isUploading
              }
              placeholder={
                isReadOnly
                  ? ""
                  : t(
                      "SocialMedia.form.content.placeholder",
                      "What would you like to share with your audience?"
                    )
              }
            />
            <div className="flex justify-between items-center mt-2">
              <div className="text-sm text-muted-foreground"></div>
              <div
                className={`text-sm ${
                  isOverLimit ? "text-destructive" : "text-muted-foreground"
                }`}
              >
                {characterCount}/{characterLimit}
              </div>
            </div>
            {isOverLimit && (
              <div className="p-2 bg-red-100 text-red-800 border border-red-200 rounded-md mt-2">
                {t(
                  "SocialMedia.form.content.characterLimit",
                  "Content exceeds character limit"
                )}
              </div>
            )}
            {hasLinkedInAccount && !linkedInValidation.isValid && (
              <div className="mt-2 space-y-2">
                {linkedInValidation.errors.map((error, index) => (
                  <div
                    key={index}
                    className="p-2 bg-red-100 text-red-800 border border-red-200 rounded-md"
                  >
                    {error}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Media Upload */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Images className="h-4 w-4 text-primary" />
              {t("SocialMedia.form.media.label", "Media Attachments")}
            </Label>

            {!isReadOnly && (
              <div className="relative mb-3">
                <Button variant="outline" className="w-full">
                  <Plus className="mr-2 h-4 w-4" />
                  {t("SocialMedia.form.media.addMedia", "Add Media")}
                </Button>
                <Input
                  type="file"
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  accept="image/*,video/*"
                  multiple={!hasLinkedInAccount}
                  onChange={(e) =>
                    handleFileSelect({
                      files: Array.from(e.target.files || []),
                    })
                  }
                  disabled={
                    isUploading ||
                    (hasLinkedInAccount && uploadedMediaUrls.length > 0)
                  }
                />
              </div>
            )}

            {isUploading && (
              <div className="mb-3">
                <div className="flex items-center gap-2 mb-2">
                  <Loader2 className="animate-spin" />
                  <span className="text-sm">
                    {t(
                      "SocialMedia.form.media.uploading",
                      "Uploading media..."
                    )}
                  </span>
                </div>
                <Progress value={uploadProgress} />
              </div>
            )}

            {/* Media Preview */}
            {uploadedMediaUrls.length > 0 && (
              <div className="space-y-2">
                {uploadedMediaUrls.map((fileKey, index) => {
                  const metadata = uploadedMediaMetadata[fileKey];
                  const filename = metadata?.filename || `File ${index + 1}`;
                  const fullUrl = metadata?.fullUrl;

                  return (
                    <div
                      key={index}
                      className="flex items-center gap-3 p-3 border rounded-lg"
                    >
                      {/* File icon */}
                      <div className="flex items-center justify-center w-12 h-12 bg-muted rounded">
                        <FileIcon className="h-6 w-6 text-muted-foreground" />
                      </div>

                      {/* File info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          {fullUrl ? (
                            <a
                              href={fullUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary hover:text-primary/80 font-medium truncate"
                            >
                              {filename}
                            </a>
                          ) : (
                            <span className="font-medium text-foreground truncate">
                              {filename}
                            </span>
                          )}
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger>
                                <CheckCircle className="text-green-500" />
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Upload successful</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                      </div>

                      {/* Remove button */}
                      {!isReadOnly && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleRemoveMedia(fileKey)}
                                className="shrink-0"
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>
                                {t(
                                  "SocialMedia.form.media.removeTooltip",
                                  "Remove media"
                                )}
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="shrink-0 border-t bg-background p-6">
        <div className="flex gap-3">
          {/* Delete button for scheduled posts */}
          {post &&
            (post.status === "scheduled" || post.status === "pending") && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={deleteMutation.isLoading}
                onClick={handleDelete}
                className="shrink-0 cursor-pointer"
              >
                {deleteMutation.isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4 text-primary" />
                )}
              </Button>
            )}

          {/* Main action button */}
          {post && canEdit && (
            <Button
              className="flex-1 cursor-pointer"
              onClick={handleUpdate}
              disabled={
                !hasChanges ||
                isPostButtonDisabled ||
                isUploading ||
                isOverLimit
              }
            >
              {updateMutation.isLoading ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Saving...</span>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Save className="h-4 w-4 text-primary" />
                  <span>
                    {t("SocialMedia.form.buttons.updatePost", "Update Post")}
                  </span>
                </div>
              )}
            </Button>
          )}

          {!post && !actualPostStatus && (
            <Button
              className="flex-1 cursor-pointer"
              onClick={handlePost}
              disabled={isPostButtonDisabled || isUploading || isOverLimit}
            >
              {scheduleMutation.isLoading ||
              postMutation.isLoading ||
              linkedInLoading ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Posting...</span>
                </div>
              ) : postType === "now" ? (
                <div className="flex items-center gap-2">
                  <Send className="h-4 w-4 text-primary" />
                  <span>
                    {t("SocialMedia.form.buttons.postNow", "Post Now")}
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <CalendarIcon className="h-4 w-4 text-primary" />
                  <span>
                    {t(
                      "SocialMedia.form.buttons.schedulePost",
                      "Schedule Post"
                    )}
                  </span>
                </div>
              )}
            </Button>
          )}

          {/* Show success status after posting */}
          {actualPostStatus && !post && (
            <div className="flex-1 flex items-center justify-center gap-2 text-green-600">
              <CheckCircle className="h-5 w-5" />
              <span className="font-medium">
                {actualPostStatus === "published" ? "Posted Successfully!" : "Scheduled Successfully!"}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default EffSocialMediaPostForm;