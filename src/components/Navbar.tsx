import { Link, useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Shield, LogOut, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { User as SupabaseUser } from "@supabase/supabase-js";
import { toast } from "sonner";

export const Navbar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    toast.success("Signed out successfully");
    navigate("/");
  };

  const isGovPortal = location.pathname.startsWith("/gov");

  if (loading) {
    return (
      <nav className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary" />
            <span className="text-xl font-bold">Corrupt Watch</span>
          </div>
        </div>
      </nav>
    );
  }

  return (
    <nav className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
      <div className="container flex h-16 items-center justify-between">
        <Link to="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
          <Shield className="h-6 w-6 text-primary" />
          <span className="text-xl font-bold">Corrupt Watch</span>
        </Link>

        <div className="flex items-center gap-4">
          {!user ? (
            <>
              <Link to="/analytics">
                <Button variant="ghost">Analytics</Button>
              </Link>
              <Link to="/submit?anonymous=true">
                <Button variant="ghost">Report Anonymously</Button>
              </Link>
              <Link to="/verify">
                <Button variant="ghost">Verify</Button>
              </Link>
              <Link to="/auth">
                <Button>Sign In</Button>
              </Link>
            </>
          ) : (
            <>
              {!isGovPortal && (
                <>
                  <Link to="/analytics">
                    <Button variant="ghost">Analytics</Button>
                  </Link>
                  <Link to="/dashboard">
                    <Button variant="ghost">My Complaints</Button>
                  </Link>
                  <Link to="/submit">
                    <Button variant="default" className="bg-accent hover:bg-accent-hover">
                      Report Issue
                    </Button>
                  </Link>
                </>
              )}
              {isGovPortal && (
                <>
                  <Link to="/gov">
                    <Button variant="ghost">Dashboard</Button>
                  </Link>
                  <Link to="/gov/complaints">
                    <Button variant="ghost">Complaints</Button>
                  </Link>
                </>
              )}
              <Button variant="ghost" size="icon">
                <User className="h-5 w-5" />
              </Button>
              <Button variant="ghost" size="icon" onClick={handleSignOut}>
                <LogOut className="h-5 w-5" />
              </Button>
            </>
          )}
        </div>
      </div>
    </nav>
  );
};
