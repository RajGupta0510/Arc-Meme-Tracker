import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useLocation } from "wouter";
import { useLaunchToken } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";

const formSchema = z.object({
  name: z.string().min(1, "Name is required").max(50),
  ticker: z.string().min(1, "Ticker is required").max(10).transform(v => v.toUpperCase()),
  description: z.string().min(10, "Description needs at least 10 chars"),
  website: z.string().url("Must be a valid URL").optional().or(z.literal("")),
  twitter: z.string().optional().or(z.literal("")),
  telegram: z.string().url("Must be a valid URL").optional().or(z.literal("")),
  logoColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Must be a valid hex color"),
});

const PRESET_COLORS = ["#22c55e", "#a855f7", "#ec4899", "#eab308", "#3b82f6", "#ef4444"];

export function LaunchPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const launchToken = useLaunchToken();
  const [success, setSuccess] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      ticker: "",
      description: "",
      website: "",
      twitter: "",
      telegram: "",
      logoColor: PRESET_COLORS[0],
    },
  });

  const watchAll = form.watch();

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    launchToken.mutate({ data: values }, {
      onSuccess: (token) => {
        setSuccess(true);
        toast({
          title: "Token Launched! 🚀",
          description: "Your token is now live on the Arc Network.",
        });
        setTimeout(() => {
          setLocation(`/token/${token.id}`);
        }, 2000);
      },
      onError: () => {
        toast({
          variant: "destructive",
          title: "Launch Failed",
          description: "Something went wrong. Probably the RPC.",
        });
      }
    });
  };

  if (success) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center min-h-[60vh]">
        <motion.div 
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="text-6xl mb-6"
        >
          🚀
        </motion.div>
        <h1 className="text-4xl font-bold uppercase tracking-tight text-primary mb-2">It's Live.</h1>
        <p className="text-muted-foreground font-mono">Redirecting to terminal...</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto w-full p-4 py-8 grid grid-cols-1 lg:grid-cols-2 gap-12">
      
      {/* Left: Form */}
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-3xl font-bold uppercase tracking-tighter">Deploy a Token</h1>
          <p className="text-muted-foreground">0.02 USDC to deploy. Liquidity locked automatically.</p>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="uppercase text-xs tracking-wider">Token Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Doge Coin" className="font-mono bg-card/50" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="ticker"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="uppercase text-xs tracking-wider">Ticker</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="DOGE" 
                        className="font-mono uppercase bg-card/50" 
                        {...field}
                        onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="uppercase text-xs tracking-wider">Description</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="What is this token about?" 
                      className="resize-none h-24 bg-card/50" 
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="logoColor"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="uppercase text-xs tracking-wider">Brand Color</FormLabel>
                  <FormControl>
                    <div className="flex gap-2 items-center">
                      <Input type="color" className="w-12 h-10 p-1 cursor-pointer bg-card/50" {...field} />
                      <div className="flex gap-2">
                        {PRESET_COLORS.map(c => (
                          <button
                            key={c}
                            type="button"
                            className={`w-8 h-8 rounded-full border-2 transition-all ${field.value === c ? 'border-foreground scale-110' : 'border-transparent hover:scale-105'}`}
                            style={{ backgroundColor: c }}
                            onClick={() => field.onChange(c)}
                          />
                        ))}
                      </div>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-4 pt-4 border-t border-border/50">
              <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Socials (Optional)</h3>
              
              <FormField
                control={form.control}
                name="website"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Input placeholder="Website URL" className="bg-card/50 font-mono text-sm" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="twitter"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Input placeholder="Twitter Handle (no @)" className="bg-card/50 font-mono text-sm" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="telegram"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Input placeholder="Telegram Group URL" className="bg-card/50 font-mono text-sm" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <Button 
              type="submit" 
              className="w-full h-12 text-lg font-bold uppercase tracking-widest text-black"
              disabled={launchToken.isPending}
            >
              {launchToken.isPending ? "Deploying..." : "Launch Token"}
            </Button>
          </form>
        </Form>
      </div>

      {/* Right: Preview */}
      <div className="flex flex-col gap-4">
        <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Live Preview</h3>
        <div className="p-6 bg-card border border-border rounded-xl shadow-2xl sticky top-24">
          <div className="flex items-start gap-4">
            <div 
              className="w-16 h-16 rounded-full flex items-center justify-center font-bold text-2xl text-white shadow-inner transition-colors duration-300"
              style={{ backgroundColor: watchAll.logoColor || "#333" }}
            >
              {(watchAll.ticker || "?").slice(0, 3)}
            </div>
            <div className="flex-1">
              <div className="font-bold uppercase text-2xl tracking-tight">
                ${watchAll.ticker || "TICKER"}
              </div>
              <div className="text-muted-foreground text-sm">
                {watchAll.name || "Token Name"}
              </div>
            </div>
            <div className="text-right">
              <div className="font-mono font-bold text-lg text-primary">Deploying...</div>
            </div>
          </div>
          <div className="mt-6 pt-6 border-t border-border/50 text-sm leading-relaxed text-muted-foreground min-h-[100px] break-words">
            {watchAll.description || "Token description will appear here..."}
          </div>
        </div>
      </div>

    </div>
  );
}