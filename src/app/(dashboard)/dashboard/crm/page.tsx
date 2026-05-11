import { PipelineBoard } from "@/components/crm/pipeline-board";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function CrmPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-3xl font-semibold tracking-tight">
          CRM visualization
        </h1>
        <p className="text-muted-foreground mt-2 max-w-3xl text-sm leading-relaxed md:text-base">
          This layer does not replace GoHighLevel. It mirrors pipelines, stages,
          and opportunities from your CRM via APIs and webhooks so leadership
          sees one operating picture.
        </p>
      </div>

      <Tabs defaultValue="pipeline" className="space-y-4">
        <TabsList className="glass w-full justify-start overflow-x-auto sm:w-auto">
          <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
          <TabsTrigger value="contacts">Contacts</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>
        <TabsContent value="pipeline" className="space-y-4">
          <PipelineBoard />
        </TabsContent>
        <TabsContent value="contacts">
          <Card className="glass-panel border-border/50">
            <CardHeader>
              <CardTitle>Contacts</CardTitle>
              <CardDescription>
                Synced contact rows, notes, and attribution will render here.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-sm">
                Wire `integrations` + worker to hydrate this grid from your CRM
                provider.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="activity">
          <Card className="glass-panel border-border/50">
            <CardHeader>
              <CardTitle>Activity history</CardTitle>
              <CardDescription>
                Calls, SMS, emails, and tasks roll up into a single timeline.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-sm">
                Use Supabase `leads` metadata and external event tables to build
                the feed.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
