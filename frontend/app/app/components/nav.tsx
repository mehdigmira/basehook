import { Link, useLocation } from "react-router";
import { Inbox, Webhook, BarChart3 } from "lucide-react";
import { cn } from "~/lib/utils";

const navItems = [
  {
    title: "Inbox",
    href: "/",
    icon: Inbox,
  },
  {
    title: "Webhooks",
    href: "/webhooks",
    icon: Webhook,
  },
  {
    title: "Metrics",
    href: "/metrics",
    icon: BarChart3,
  },
];

export function Nav() {
  const location = useLocation();

  return (
    <nav className="border-b">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center">
          <div className="flex items-center gap-8">
            <div className="font-semibold text-lg">Basehook</div>
            <div className="flex gap-6">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    to={item.href}
                    className={cn(
                      "flex items-center gap-2 text-sm font-medium transition-colors hover:text-primary",
                      isActive
                        ? "text-foreground border-b-2 border-primary"
                        : "text-muted-foreground"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {item.title}
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}
