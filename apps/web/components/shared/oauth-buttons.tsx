"use client";

import { Button } from "@/components/ui/button";
import { oauthSignInAction } from "@/actions/auth";

/** SAD §6.5: Google/Microsoft OAuth SSO entry points. */
export function OAuthButtons() {
  return (
    <div className="grid grid-cols-2 gap-3">
      <Button variant="secondary" onClick={() => void oauthSignInAction("google")} type="button">
        Google
      </Button>
      <Button variant="secondary" onClick={() => void oauthSignInAction("azure")} type="button">
        Microsoft
      </Button>
    </div>
  );
}
