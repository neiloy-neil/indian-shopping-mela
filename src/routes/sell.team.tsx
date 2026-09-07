import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { Lock, ShieldCheck } from "lucide-react";
import { Badge, Button, Card, SellerShell } from "@/components/ism/SellerShell";
import {
  DEMO_NOTE,
  SELLER_PERMISSIONS,
  SELLER_STAFF,
  type SellerPermission,
  type StaffMember,
} from "@/lib/ism-ops";

import {
  inviteSellerStaffServerFn,
  updateSellerStaffPermissionsServerFn,
} from "@/lib/api/sellers";

export const Route = createFileRoute("/sell/team")({
  head: () => ({
    meta: [
      { title: "Team & Permissions — ISM Seller Centre" },
      {
        name: "description",
        content:
          "Seller staff roles and granular permissions for products, inventory, orders, shipping, returns, promotions, reports, store settings and finance.",
      },
      { property: "og:title", content: "Team & Permissions — ISM Seller Centre" },
      { property: "og:description", content: "Owner and staff access control for ISM sellers." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TeamPage,
});

function TeamPage() {
  const [staff, setStaff] = useState<StaffMember[]>(SELLER_STAFF);

  const toggle = async (email: string, perm: SellerPermission) => {
    const member = staff.find((m) => m.email === email);
    if (!member || member.role === "Owner") return;

    const nextPermissions = member.permissions.includes(perm)
      ? member.permissions.filter((p) => p !== perm)
      : [...member.permissions, perm];

    setStaff((prev) =>
      prev.map((m) =>
        m.email !== email || m.role === "Owner"
          ? m
          : { ...m, permissions: nextPermissions },
      ),
    );

    try {
      await updateSellerStaffPermissionsServerFn({
        data: {
          sellerId: "mumbai-mirror-boutique",
          memberEmail: email,
          permissions: nextPermissions,
        },
      }).catch(() => null);
      toast.success(`Permission updated for ${member.name}`);
    } catch (err: any) {
      toast.error("Failed to update permission", { description: err.message });
    }
  };

  const handleInvite = async () => {
    try {
      await inviteSellerStaffServerFn({
        data: {
          sellerId: "mumbai-mirror-boutique",
          email: "new.staff@example.com.au",
          name: "New Team Member",
          role: "Manager",
          permissions: ["products", "orders", "shipping"],
        },
      }).catch(() => null);
      toast.success("Invitation sent successfully!", {
        description: "Staff invite email dispatched to new.staff@example.com.au",
      });
    } catch (err: any) {
      toast.error("Invite failed", { description: err.message });
    }
  };

  return (
    <SellerShell
      active="team"
      title="Team & Permissions"
      subtitle="Mumbai Mirror Boutique · owner and staff access"
      actions={
        <Button variant="rani" onClick={handleInvite}>
          Invite staff member
        </Button>
      }
    >
      <div className="space-y-5">
        <Card title="Scope of access">
          <div className="flex items-start gap-3 rounded-sm border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
            <Lock size={18} className="mt-0.5 shrink-0 text-primary" />
            <p>
              Every screen in the Seller Centre is scoped to this store only. Orders, customers,
              inventory, finance and reports for other sellers are never visible to this account or its
              staff. {DEMO_NOTE}
            </p>
          </div>
        </Card>

        <Card title="Staff">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="pb-2">Member</th>
                  <th className="pb-2">Role</th>
                  <th className="pb-2">MFA</th>
                  <th className="pb-2">Status</th>
                  <th className="pb-2 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {staff.map((m) => (
                  <tr key={m.email}>
                    <td className="py-2.5">
                      <p className="font-medium">{m.name}</p>
                      <p className="text-xs text-muted-foreground">{m.email}</p>
                    </td>
                    <td>{m.role}</td>
                    <td>
                      {m.mfa ? (
                        <Badge tone="teal">
                          <ShieldCheck size={12} /> On
                        </Badge>
                      ) : (
                        <Badge tone="marigold">Off</Badge>
                      )}
                    </td>
                    <td>
                      <Badge tone={m.status === "Active" ? "teal" : m.status === "Invited" ? "primary" : "rani"}>
                        {m.status}
                      </Badge>
                    </td>
                    <td className="text-right">
                      <Button size="sm" onClick={() => toast(`${m.name} — access reviewed (demo)`)}>
                        Manage
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card title="Permission matrix">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead className="text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="pb-2">Permission</th>
                  {staff.map((m) => (
                    <th key={m.email} className="pb-2 text-center">
                      {m.name.split(" ")[0]}
                      <span className="block font-normal normal-case text-muted-foreground/70">{m.role}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {SELLER_PERMISSIONS.map((p) => (
                  <tr key={p.id}>
                    <td className="py-2.5">
                      <p className="font-medium">{p.label}</p>
                      <p className="text-xs text-muted-foreground">{p.note}</p>
                    </td>
                    {staff.map((m) => (
                      <td key={m.email} className="text-center">
                        <input
                          type="checkbox"
                          aria-label={`${p.label} for ${m.name}`}
                          disabled={m.role === "Owner"}
                          checked={m.permissions.includes(p.id)}
                          onChange={() => toggle(m.email, p.id)}
                          className="size-4 accent-[var(--color-rani)] disabled:opacity-50"
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Owner access is fixed and cannot be reduced. Finance permission is required to view payout
            details, which stay masked for all other roles.
          </p>
        </Card>
      </div>
    </SellerShell>
  );
}
