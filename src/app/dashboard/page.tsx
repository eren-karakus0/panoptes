import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function DashboardPage() {
  return (
    <div>
      <div className="mb-8">
        <h1 className="font-display text-3xl font-bold text-mist">
          Dashboard
        </h1>
        <p className="mt-1 text-sm text-dusty-lavender/70">
          Republic chain overview
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-slate-DEFAULT/20 bg-midnight-plum">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-dusty-lavender/70">
              Validators
            </CardTitle>
            <Badge variant="outline" className="text-teal-DEFAULT border-teal-DEFAULT/30">
              Active
            </Badge>
          </CardHeader>
          <CardContent>
            <div className="font-mono text-2xl font-bold text-mist">--</div>
            <p className="text-xs text-dusty-lavender/50">Loading...</p>
          </CardContent>
        </Card>

        <Card className="border-slate-DEFAULT/20 bg-midnight-plum">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-dusty-lavender/70">
              Block Height
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="font-mono text-2xl font-bold text-mist">--</div>
            <p className="text-xs text-dusty-lavender/50">Loading...</p>
          </CardContent>
        </Card>

        <Card className="border-slate-DEFAULT/20 bg-midnight-plum">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-dusty-lavender/70">
              Total Staked
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="font-mono text-2xl font-bold text-mist">--</div>
            <p className="text-xs text-dusty-lavender/50">Loading...</p>
          </CardContent>
        </Card>

        <Card className="border-slate-DEFAULT/20 bg-midnight-plum">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-dusty-lavender/70">
              Endpoints
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="font-mono text-2xl font-bold text-mist">--</div>
            <p className="text-xs text-dusty-lavender/50">Loading...</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
