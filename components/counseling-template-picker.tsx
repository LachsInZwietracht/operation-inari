"use client"

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { COUNSELING_TEMPLATES } from "@/lib/mock-data"

interface CounselingTemplatePickerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelect: (content: string) => void
}

export function CounselingTemplatePicker({
  open,
  onOpenChange,
  onSelect,
}: CounselingTemplatePickerProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[80vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Vorlage auswählen</DialogTitle>
          <DialogDescription>
            Wählen Sie eine Beratungsvorlage aus, um den Text einzufügen.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {COUNSELING_TEMPLATES.map((template) => (
            <Card
              key={template.id}
              className="cursor-pointer transition-colors hover:bg-muted/50"
              onClick={() => {
                onSelect(template.content)
                onOpenChange(false)
              }}
            >
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <CardTitle className="text-sm">{template.name}</CardTitle>
                  <div className="flex gap-1">
                    <Badge variant="outline" className="text-xs">
                      {template.type}
                    </Badge>
                    <Badge variant="secondary" className="text-xs">
                      {template.indication}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground line-clamp-3 whitespace-pre-wrap">
                  {template.content}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
