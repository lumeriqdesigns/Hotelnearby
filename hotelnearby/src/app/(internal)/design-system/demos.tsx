"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { DropdownMenu } from "@/components/ui/dropdown-menu";
import { MobileNav } from "@/components/ui/mobile-nav";
import { TextField } from "@/components/ui/form-fields";

export function DialogDemo() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        Open dialog
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Sample dialog"
        description="Focus stays inside until you close it. Escape, the close button and the backdrop all work."
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => setOpen(false)}>Confirm</Button>
          </>
        }
      >
        <TextField
          label="Sample field"
          hint="Focus starts here because it is marked data-autofocus."
          data-autofocus
        />
      </Dialog>
    </>
  );
}

export function DropdownDemo() {
  const [last, setLast] = useState("Nothing chosen yet");
  return (
    <div className="flex flex-wrap items-center gap-4">
      <DropdownMenu
        label="Actions"
        items={[
          { kind: "link", label: "Jump to colours", href: "#colour" },
          { kind: "link", label: "Jump to buttons", href: "#buttons" },
          { kind: "separator" },
          { kind: "action", label: "Choose an action", onSelect: () => setLast("Chose an action") },
          { kind: "action", label: "Disabled item", onSelect: () => {}, disabled: true },
          {
            kind: "action",
            label: "Remove (danger)",
            tone: "danger",
            onSelect: () => setLast("Chose the danger action"),
          },
        ]}
      />
      <p role="status" className="text-small text-muted-foreground">
        {last}
      </p>
    </div>
  );
}

export function LoadingButtonDemo() {
  const [loading, setLoading] = useState(false);
  return (
    <Button
      loading={loading}
      onClick={() => {
        setLoading(true);
        setTimeout(() => setLoading(false), 1800);
      }}
    >
      {loading ? "Saving" : "Save changes"}
    </Button>
  );
}

export function MobileNavDemo() {
  return (
    <div className="relative rounded-md border">
      <div className="flex items-center justify-between p-2">
        <span className="px-3 text-small text-muted-foreground">Small-screen menu</span>
        <MobileNav
          label="Design system sections"
          items={[
            { label: "Colour", href: "/design-system#colour" },
            { label: "Typography", href: "/design-system#typography" },
            { label: "Buttons", href: "/design-system#buttons" },
          ]}
        />
      </div>
    </div>
  );
}
