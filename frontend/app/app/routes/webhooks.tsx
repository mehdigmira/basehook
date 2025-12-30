import { useState, useEffect } from "react"
import type { Route } from "./+types/webhooks"
import {
  Settings,
  Plus,
  ChevronDown,
  MessageSquare,
  Github,
  ShoppingBag,
  CreditCard,
  Phone,
  Wrench,
  SlackIcon,
  AlertCircle,
  Eye,
  EyeOff
} from "lucide-react"
import { Button } from "~/components/ui/button"
import { Input } from "~/components/ui/input"
import { Label } from "~/components/ui/label"
import { Switch } from "~/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog"

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Webhooks - Basehook" },
    { name: "description", content: "Manage your webhook configurations" },
  ]
}

interface Webhook {
  name: string
  thread_id_path: string[]
  revision_number_path: string[]
  hmac_enabled: boolean
  hmac_secret?: string
  hmac_header?: string
  hmac_timestamp_header?: string
  hmac_signature_format?: string
  hmac_encoding?: string
  hmac_algorithm?: string
  hmac_prefix?: string
  last_error?: string | null
  last_error_timestamp?: number | null
}

const WEBHOOK_PRESETS: Record<string, Partial<Webhook>> = {
  slack: {
    name: "",
    thread_id_path: ["event", "thread_ts"],
    revision_number_path: ["event_time"],
    hmac_enabled: true,
    hmac_header: "X-Slack-Signature",
    hmac_timestamp_header: "X-Slack-Request-Timestamp",
    hmac_signature_format: "v0:{timestamp}:{body}",
    hmac_encoding: "hex",
    hmac_algorithm: "sha256",
    hmac_prefix: "v0=",
  },
  github: {
    name: "",
    thread_id_path: ["repository", "full_name"],
    revision_number_path: ["head_commit", "timestamp"],
    hmac_enabled: true,
    hmac_header: "X-Hub-Signature-256",
    hmac_signature_format: "{body}",
    hmac_encoding: "hex",
    hmac_algorithm: "sha256",
    hmac_prefix: "sha256=",
  },
  shopify: {
    name: "",
    thread_id_path: ["id"],
    revision_number_path: ["updated_at"],
    hmac_enabled: true,
    hmac_header: "X-Shopify-Hmac-SHA256",
    hmac_signature_format: "{body}",
    hmac_encoding: "base64",
    hmac_algorithm: "sha256",
  },
  stripe: {
    name: "",
    thread_id_path: ["data", "object", "id"],
    revision_number_path: ["created"],
    hmac_enabled: true,
    hmac_header: "Stripe-Signature",
    hmac_signature_format: "{timestamp}.{body}",
    hmac_encoding: "hex",
    hmac_algorithm: "sha256",
  },
  twilio: {
    name: "",
    thread_id_path: ["MessageSid"],
    revision_number_path: ["DateSent"],
    hmac_enabled: true,
    hmac_header: "X-Twilio-Signature",
    hmac_signature_format: "{url}{body}",
    hmac_encoding: "base64",
    hmac_algorithm: "sha1",
  },
  custom: {
    name: "",
    thread_id_path: [],
    revision_number_path: [],
    hmac_enabled: false,
  },
}

export default function Webhooks() {
  const [webhooks, setWebhooks] = useState<Webhook[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedWebhook, setSelectedWebhook] = useState<Webhook | null>(null)
  const [originalWebhookName, setOriginalWebhookName] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [showSecret, setShowSecret] = useState(false)

  const fetchWebhooks = async () => {
    setLoading(true)
    try {
      const response = await fetch("/api/webhooks")
      if (!response.ok) {
        throw new Error("Failed to fetch webhooks")
      }
      const result = await response.json()
      setWebhooks(result.webhooks || [])
    } catch (error) {
      console.error("Failed to fetch webhooks:", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchWebhooks()
  }, [])

  const handleWebhookClick = (webhook: Webhook) => {
    setSelectedWebhook(webhook)
    setOriginalWebhookName(webhook.name)
    setIsEditing(false)
    setIsCreating(false)
    setDialogOpen(true)
  }

  const handleEditClick = () => {
    setIsEditing(true)
  }

  const handleSave = async () => {
    if (!selectedWebhook) return

    setSaving(true)
    try {
      if (isCreating) {
        // Create new webhook
        const response = await fetch("/api/webhooks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: selectedWebhook.name,
            thread_id_path: selectedWebhook.thread_id_path,
            revision_number_path: selectedWebhook.revision_number_path,
            hmac_enabled: selectedWebhook.hmac_enabled,
            hmac_secret: selectedWebhook.hmac_secret,
            hmac_header: selectedWebhook.hmac_header,
            hmac_timestamp_header: selectedWebhook.hmac_timestamp_header,
            hmac_signature_format: selectedWebhook.hmac_signature_format,
            hmac_encoding: selectedWebhook.hmac_encoding,
            hmac_algorithm: selectedWebhook.hmac_algorithm,
            hmac_prefix: selectedWebhook.hmac_prefix,
          }),
        })

        if (!response.ok) {
          const error = await response.json()
          throw new Error(error.detail || "Failed to create webhook")
        }
      } else {
        // Update existing webhook (use original name in URL)
        const response = await fetch(`/api/webhooks/${originalWebhookName}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: selectedWebhook.name, // Allow renaming
            thread_id_path: selectedWebhook.thread_id_path,
            revision_number_path: selectedWebhook.revision_number_path,
            hmac_enabled: selectedWebhook.hmac_enabled,
            hmac_secret: selectedWebhook.hmac_secret,
            hmac_header: selectedWebhook.hmac_header,
            hmac_timestamp_header: selectedWebhook.hmac_timestamp_header,
            hmac_signature_format: selectedWebhook.hmac_signature_format,
            hmac_encoding: selectedWebhook.hmac_encoding,
            hmac_algorithm: selectedWebhook.hmac_algorithm,
            hmac_prefix: selectedWebhook.hmac_prefix,
          }),
        })

        if (!response.ok) {
          const error = await response.json()
          throw new Error(error.detail || "Failed to update webhook")
        }
      }

      setIsEditing(false)
      setDialogOpen(false)
      await fetchWebhooks()
    } catch (error) {
      console.error("Failed to save webhook:", error)
      alert(error instanceof Error ? error.message : "Failed to save webhook")
    } finally {
      setSaving(false)
    }
  }

  const handleNewWebhook = (presetType: string) => {
    const preset = WEBHOOK_PRESETS[presetType]
    setSelectedWebhook(preset as Webhook)
    setIsEditing(true)
    setIsCreating(true)
    setDialogOpen(true)
  }

  return (
    <div className="container mx-auto py-10">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Webhooks</h1>
            <p className="text-muted-foreground">
              Manage your webhook configurations
            </p>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                New Webhook
                <ChevronDown className="ml-2 h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={() => handleNewWebhook("slack")}>
                <SlackIcon className="mr-2 h-4 w-4" />
                Slack
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleNewWebhook("github")}>
                <Github className="mr-2 h-4 w-4" />
                GitHub
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleNewWebhook("shopify")}>
                <ShoppingBag className="mr-2 h-4 w-4" />
                Shopify
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleNewWebhook("stripe")}>
                <CreditCard className="mr-2 h-4 w-4" />
                Stripe
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleNewWebhook("twilio")}>
                <Phone className="mr-2 h-4 w-4" />
                Twilio
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleNewWebhook("custom")}>
                <Wrench className="mr-2 h-4 w-4" />
                Custom
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {loading ? (
          <div className="rounded-lg border p-8 text-center text-muted-foreground">
            Loading webhooks...
          </div>
        ) : webhooks.length === 0 ? (
          <div className="rounded-lg border p-8 text-center text-muted-foreground">
            No webhooks configured yet. Create your first webhook to get started.
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {webhooks.map((webhook) => (
              <div
                key={webhook.name}
                className="rounded-lg border p-6 hover:bg-accent hover:cursor-pointer transition-colors"
                onClick={() => handleWebhookClick(webhook)}
              >
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">/{webhook.name}</h3>
                      {webhook.last_error && (
                        <AlertCircle className="h-4 w-4 text-destructive" />
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Thread ID: {webhook.thread_id_path.join(" → ")}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Revision: {webhook.revision_number_path.join(" → ")}
                    </p>
                  </div>
                  <Settings className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="mt-4 space-y-2">
                  {webhook.hmac_enabled && (
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-green-500" />
                      <span className="text-xs text-muted-foreground">
                        HMAC Enabled
                      </span>
                    </div>
                  )}
                  {webhook.last_error && (
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-destructive" />
                      <span className="text-xs text-destructive">
                        {webhook.last_error}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{selectedWebhook?.name}</DialogTitle>
              <DialogDescription>
                Webhook configuration details
              </DialogDescription>
            </DialogHeader>

            {selectedWebhook && !isEditing && (
              <div className="space-y-6">
                <div>
                  <h4 className="text-sm font-medium mb-2">Basic Settings</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Name:</span>
                      <span className="font-mono">{selectedWebhook.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Thread ID Path:</span>
                      <span className="font-mono">{selectedWebhook.thread_id_path.join(" → ")}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Revision Path:</span>
                      <span className="font-mono">{selectedWebhook.revision_number_path.join(" → ")}</span>
                    </div>
                  </div>
                </div>

                {selectedWebhook.last_error && (
                  <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="h-5 w-5 text-destructive mt-0.5" />
                      <div className="space-y-1 flex-1">
                        <h4 className="text-sm font-medium text-destructive">Validation Error</h4>
                        <p className="text-sm text-muted-foreground">{selectedWebhook.last_error}</p>
                        {selectedWebhook.last_error_timestamp && (
                          <p className="text-xs text-muted-foreground">
                            Last occurred: {new Date(selectedWebhook.last_error_timestamp * 1000).toLocaleString()}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                <div>
                  <h4 className="text-sm font-medium mb-2">HMAC Authentication</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Enabled:</span>
                      <span>{selectedWebhook.hmac_enabled ? "Yes" : "No"}</span>
                    </div>
                    {selectedWebhook.hmac_enabled && (
                      <>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Secret:</span>
                          <span className="font-mono text-xs">
                            {selectedWebhook.hmac_secret ? "••••••••" : "Not set"}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Header:</span>
                          <span className="font-mono text-xs">{selectedWebhook.hmac_header || "N/A"}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Algorithm:</span>
                          <span className="font-mono text-xs">{selectedWebhook.hmac_algorithm || "N/A"}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Encoding:</span>
                          <span className="font-mono text-xs">{selectedWebhook.hmac_encoding || "N/A"}</span>
                        </div>
                        {selectedWebhook.hmac_signature_format && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Signature Format:</span>
                            <span className="font-mono text-xs">{selectedWebhook.hmac_signature_format}</span>
                          </div>
                        )}
                        {selectedWebhook.hmac_prefix && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Prefix:</span>
                            <span className="font-mono text-xs">{selectedWebhook.hmac_prefix}</span>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>

                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setDialogOpen(false)}>
                    Close
                  </Button>
                  <Button onClick={handleEditClick}>Edit Webhook</Button>
                </div>
              </div>
            )}

            {selectedWebhook && isEditing && (
              <div className="space-y-6">
                <div className="space-y-4">
                  <h4 className="text-sm font-medium">Basic Settings</h4>

                  <div className="space-y-2">
                    <Label htmlFor="webhook-name">Webhook path</Label>
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">/</span>
                      <Input
                        id="webhook-name"
                        value={selectedWebhook.name || ""}
                        onChange={(e) =>
                          setSelectedWebhook({ ...selectedWebhook, name: e.target.value })
                        }
                        placeholder="e.g., my-slack-webhook"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="thread-id-path">Thread ID Path</Label>
                    <Input
                      id="thread-id-path"
                      value={selectedWebhook.thread_id_path?.join(".") || ""}
                      onChange={(e) =>
                        setSelectedWebhook({
                          ...selectedWebhook,
                          thread_id_path: e.target.value.split(".").filter(Boolean)
                        })
                      }
                      placeholder="e.g., event.thread_ts"
                    />
                    <p className="text-xs text-muted-foreground">
                      Dot-separated path to extract thread ID from JSON payload
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="revision-path">Revision Number Path</Label>
                    <Input
                      id="revision-path"
                      value={selectedWebhook.revision_number_path?.join(".") || ""}
                      onChange={(e) =>
                        setSelectedWebhook({
                          ...selectedWebhook,
                          revision_number_path: e.target.value.split(".").filter(Boolean)
                        })
                      }
                      placeholder="e.g., event_time"
                    />
                    <p className="text-xs text-muted-foreground">
                      Dot-separated path to extract revision number from JSON payload
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="text-sm font-medium">HMAC Authentication</h4>

                  <div className="flex items-center justify-between">
                    <Label htmlFor="hmac-enabled">Enable HMAC</Label>
                    <Switch
                      id="hmac-enabled"
                      checked={selectedWebhook.hmac_enabled}
                      onCheckedChange={(checked) =>
                        setSelectedWebhook({ ...selectedWebhook, hmac_enabled: checked })
                      }
                    />
                  </div>

                  {selectedWebhook.hmac_enabled && (
                    <>
                      <div className="space-y-2">
                        <Label htmlFor="hmac-secret">Secret Key</Label>
                        <div className="relative">
                          <Input
                            id="hmac-secret"
                            type={showSecret ? "text" : "password"}
                            value={selectedWebhook.hmac_secret || ""}
                            onChange={(e) =>
                              setSelectedWebhook({ ...selectedWebhook, hmac_secret: e.target.value })
                            }
                            placeholder="Enter secret key"
                            className="pr-10"
                          />
                          <button
                            type="button"
                            onClick={() => setShowSecret(!showSecret)}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                            tabIndex={-1}
                          >
                            {showSecret ? (
                              <EyeOff className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="hmac-header">Signature Header</Label>
                        <Input
                          id="hmac-header"
                          value={selectedWebhook.hmac_header || ""}
                          onChange={(e) =>
                            setSelectedWebhook({ ...selectedWebhook, hmac_header: e.target.value })
                          }
                          placeholder="e.g., X-Webhook-Signature"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="hmac-algorithm">Algorithm</Label>
                        <Select
                          value={selectedWebhook.hmac_algorithm || "sha256"}
                          onValueChange={(value) =>
                            setSelectedWebhook({ ...selectedWebhook, hmac_algorithm: value })
                          }
                        >
                          <SelectTrigger id="hmac-algorithm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="sha256">SHA-256</SelectItem>
                            <SelectItem value="sha1">SHA-1</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="hmac-encoding">Encoding</Label>
                        <Select
                          value={selectedWebhook.hmac_encoding || "hex"}
                          onValueChange={(value) =>
                            setSelectedWebhook({ ...selectedWebhook, hmac_encoding: value })
                          }
                        >
                          <SelectTrigger id="hmac-encoding">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="hex">Hex</SelectItem>
                            <SelectItem value="base64">Base64</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="hmac-format">Signature Format</Label>
                        <Input
                          id="hmac-format"
                          value={selectedWebhook.hmac_signature_format || ""}
                          onChange={(e) =>
                            setSelectedWebhook({ ...selectedWebhook, hmac_signature_format: e.target.value })
                          }
                          placeholder="e.g., {body} or v0:{timestamp}:{body}"
                        />
                        <p className="text-xs text-muted-foreground">
                          Use {"{body}"}, {"{timestamp}"}, {"{url}"} as placeholders
                        </p>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="hmac-prefix">Signature Prefix (optional)</Label>
                        <Input
                          id="hmac-prefix"
                          value={selectedWebhook.hmac_prefix || ""}
                          onChange={(e) =>
                            setSelectedWebhook({ ...selectedWebhook, hmac_prefix: e.target.value })
                          }
                          placeholder="e.g., v0= or sha256="
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="hmac-timestamp-header">Timestamp Header (optional)</Label>
                        <Input
                          id="hmac-timestamp-header"
                          value={selectedWebhook.hmac_timestamp_header || ""}
                          onChange={(e) =>
                            setSelectedWebhook({ ...selectedWebhook, hmac_timestamp_header: e.target.value })
                          }
                          placeholder="e.g., X-Slack-Request-Timestamp"
                        />
                      </div>
                    </>
                  )}
                </div>

                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setIsEditing(false)
                      if (isCreating) {
                        setDialogOpen(false)
                      }
                    }}
                    disabled={saving}
                  >
                    Cancel
                  </Button>
                  <Button onClick={handleSave} disabled={saving}>
                    {saving ? "Saving..." : isCreating ? "Create Webhook" : "Save Changes"}
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}
