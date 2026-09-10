import { useState, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { Lock, ShieldCheck, UserPlus, Trash2 } from "lucide-react";
import { Badge, Button, Card, SellerShell } from "@/components/ism/SellerShell";
import { SELLER_PERMISSIONS, type SellerPermission, type StaffMember } from "@/lib/ism-ops";
import { useAuth } from "@/hooks/use-auth";

import {
  getCurrentSellerProfile,
  getSellerTeamMembersServerFn,
  inviteSellerStaffServerFn,
  updateSellerStaffPermissionsServerFn,
  revokeSellerStaffMemberServerFn,
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

const DEFAULT_MEMBERS: StaffMember[] = [
  {
    name: "Aarav Patel",
    email: "aarav@mumbaiboutique.com.au",
    role: "Owner",
    permissions: [
      "products",
      "orders",
      "inventory",
      "shipping",
      "returns",
      "promotions",
      "reports",
      "store",
      "finance",
    ],
    mfa: true,
    status: "Active",
  },
  {
    name: "Priya Sharma",
    email: "priya@mumbaiboutique.com.au",
    role: "Manager",
    permissions: ["products", "orders", "inventory", "shipping", "returns"],
    mfa: true,
    status: "Active",
  },
  {
    name: "Rohan Verma",
    email: "rohan@mumbaiboutique.com.au",
    role: "Dispatch",
    permissions: ["orders", "shipping"],
    mfa: false,
    status: "Active",
  },
];

function TeamPage() {
  const { user } = useAuth();
  const [resolvedSellerId, setResolvedSellerId] = useState<string | null>(null);
  const sellerId = resolvedSellerId;
  const [staff, setStaff] = useState<StaffMember[]>(DEFAULT_MEMBERS);
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteRole, setInviteRole] = useState<"Owner" | "Manager" | "Dispatch" | "Finance">(
    "Manager",
  );
  const [invitePerms, setInvitePerms] = useState<SellerPermission[]>([
    "products",
    "orders",
    "shipping",
  ]);
  const [isInviting, setIsInviting] = useState(false);

  useEffect(() => {
    getCurrentSellerProfile()
      .then((seller) => {
        if (seller?.id) setResolvedSellerId(seller.id);
      })
      .catch(() => null);
  }, [user?.id]);

  useEffect(() => {
    if (!sellerId) return;
    getSellerTeamMembersServerFn({ data: { sellerId } })
      .then((members) => {
        if (members && members.length > 0) {
          const mapped: StaffMember[] = members.map((m: any) => ({
            name: m.profiles?.full_name || m.user_id || "Team Member",
            email: m.profiles?.email || `staff_${m.id.slice(0, 6)}@store.com`,
            role: (m.role as "Owner" | "Manager" | "Dispatch" | "Finance") || "Manager",
            permissions: (Array.isArray(m.permissions)
              ? m.permissions
              : ["products", "orders"]) as SellerPermission[],
            mfa: m.role === "Owner",
            status: "Active",
          }));
          setStaff(mapped);
        }
      })
      .catch(() => null);
  }, [sellerId]);

  const toggle = async (email: string, perm: SellerPermission) => {
    const member = staff.find((m) => m.email === email);
    if (!member || member.role === "Owner" || !sellerId) return;

    const nextPermissions = member.permissions.includes(perm)
      ? member.permissions.filter((p) => p !== perm)
      : [...member.permissions, perm];

    setStaff((prev) =>
      prev.map((m) =>
        m.email !== email || m.role === "Owner" ? m : { ...m, permissions: nextPermissions },
      ),
    );

    try {
      await updateSellerStaffPermissionsServerFn({
        data: {
          sellerId,
          memberEmail: email,
          permissions: nextPermissions,
        },
      });
      toast.success(`Permission updated for ${member.name}`);
    } catch (err: any) {
      toast.error("Failed to update permission", { description: err.message });
    }
  };

  const handleRevoke = async (member: StaffMember) => {
    if (member.role === "Owner") {
      toast.error("Cannot revoke store owner");
      return;
    }
    if (!sellerId) return;

    try {
      await revokeSellerStaffMemberServerFn({
        data: {
          sellerId,
          memberEmail: member.email,
        },
      });
      setStaff((prev) => prev.filter((m) => m.email !== member.email));
      toast.success(`Access revoked for ${member.name}`);
    } catch (err: any) {
      toast.error("Failed to revoke member", { description: err.message });
    }
  };

  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail || !inviteName) {
      toast.error("Please provide email and name");
      return;
    }
    if (!sellerId) {
      toast.error("Seller account required", {
        description: "Complete seller onboarding before inviting team members.",
      });
      return;
    }

    setIsInviting(true);
    try {
      await inviteSellerStaffServerFn({
        data: {
          sellerId,
          email: inviteEmail,
          name: inviteName,
          role: inviteRole,
          permissions: invitePerms,
        },
      });

      setStaff((prev) => [
        ...prev,
        {
          name: inviteName,
          email: inviteEmail,
          role: inviteRole,
          permissions: invitePerms as SellerPermission[],
          mfa: false,
          status: "Invited",
        },
      ]);

      toast.success("Invitation dispatched successfully!", {
        description: `Secure invite link sent to ${inviteEmail}`,
      });
      setIsInviteOpen(false);
      setInviteEmail("");
      setInviteName("");
    } catch (err: any) {
      toast.error("Invite failed", { description: err.message });
    } finally {
      setIsInviting(false);
    }
  };

  return (
    <SellerShell
      active="team"
      title="Team & Permissions"
      subtitle="Mumbai Mirror Boutique · owner and staff access"
      actions={
        <Button variant="rani" onClick={() => setIsInviteOpen(true)}>
          <UserPlus size={15} className="mr-1.5" /> Invite staff member
        </Button>
      }
    >
      <div className="space-y-5">
        <Card title="Scope of access">
          <div className="flex items-start gap-3 rounded-sm border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
            <Lock size={18} className="mt-0.5 shrink-0 text-primary" />
            <p>
              Every screen in the Seller Centre is scoped to this store only. Orders, customers,
              inventory, finance and reports for other sellers are never accessible to this account
              or its staff.
            </p>
          </div>
        </Card>

        {isInviteOpen && (
          <Card title="Invite new team member">
            <form onSubmit={handleSendInvite} className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <label className="text-xs font-semibold">Full Name</label>
                  <input
                    value={inviteName}
                    onChange={(e) => setInviteName(e.target.value)}
                    placeholder="e.g. Ananya Rao"
                    required
                    className="mt-1 h-9 w-full rounded-sm border border-input bg-surface px-3 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold">Email Address</label>
                  <input
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="ananya@store.com"
                    required
                    className="mt-1 h-9 w-full rounded-sm border border-input bg-surface px-3 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold">Role</label>
                  <select
                    value={inviteRole}
                    onChange={(e) =>
                      setInviteRole(e.target.value as "Owner" | "Manager" | "Dispatch" | "Finance")
                    }
                    className="mt-1 h-9 w-full rounded-sm border border-input bg-surface px-2 text-sm"
                  >
                    <option value="Manager">Manager</option>
                    <option value="Dispatch">Dispatch</option>
                    <option value="Finance">Finance</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold">Assigned Permissions</label>
                <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {SELLER_PERMISSIONS.map((p) => (
                    <label
                      key={p.id}
                      className="flex items-center gap-2 rounded-sm border border-border p-2 text-xs"
                    >
                      <input
                        type="checkbox"
                        checked={invitePerms.includes(p.id)}
                        onChange={(e) => {
                          if (e.target.checked) setInvitePerms((prev) => [...prev, p.id]);
                          else setInvitePerms((prev) => prev.filter((x) => x !== p.id));
                        }}
                        className="size-4 accent-[var(--color-rani)]"
                      />
                      <span>{p.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex gap-2">
                <Button type="submit" variant="rani" disabled={isInviting}>
                  {isInviting ? "Sending..." : "Send Secure Invitation"}
                </Button>
                <Button type="button" variant="outline" onClick={() => setIsInviteOpen(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          </Card>
        )}

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
                      <Badge
                        tone={
                          m.status === "Active"
                            ? "teal"
                            : m.status === "Invited"
                              ? "primary"
                              : "rani"
                        }
                      >
                        {m.status}
                      </Badge>
                    </td>
                    <td className="text-right">
                      {m.role !== "Owner" ? (
                        <button
                          onClick={() => handleRevoke(m)}
                          className="inline-flex items-center gap-1 rounded-sm border border-border px-2.5 py-1 text-xs text-muted-foreground hover:border-rani hover:text-rani"
                        >
                          <Trash2 size={13} /> Revoke
                        </button>
                      ) : (
                        <span className="text-xs text-muted-foreground font-semibold">
                          Fixed Owner
                        </span>
                      )}
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
                      <span className="block font-normal normal-case text-muted-foreground/70">
                        {m.role}
                      </span>
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
            Owner access is fixed and cannot be reduced. Finance permission is required to view
            payout details, which stay masked for all other roles.
          </p>
        </Card>
      </div>
    </SellerShell>
  );
}
