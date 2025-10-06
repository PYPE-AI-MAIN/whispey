"use client"

import { useState } from "react"
import { Check, Zap, Building2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"

export function PricingSection() {
  const [isYearly, setIsYearly] = useState(false)

  const plans = [
    {
      name: "Starter",
      description: "Perfect for individual developers and small projects",
      icon: Zap,
      monthlyPrice: 29,
      yearlyPrice: 290,
      features: [
        "Up to 10,000 voice sessions/month",
        "Real-time monitoring dashboard",
        "Basic analytics & insights",
        "Email support",
        "API access",
        "7-day data retention",
      ],
      popular: false,
    },
    {
      name: "Professional",
      description: "Ideal for growing teams and production applications",
      icon: Building2,
      monthlyPrice: 99,
      yearlyPrice: 990,
      features: [
        "Up to 100,000 voice sessions/month",
        "Advanced analytics & custom metrics",
        "Real-time alerts & notifications",
        "Priority support",
        "Custom integrations",
        "30-day data retention",
        "Team collaboration tools",
        "Advanced debugging tools",
      ],
      popular: true,
    },
  ]

  return (
    <section className="py-24 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-balance mb-4">Simple, transparent pricing</h2>
          <p className="text-xl text-muted-foreground text-balance max-w-2xl mx-auto mb-8">
            Choose the perfect plan for your voice AI monitoring needs. Start free, scale as you grow.
          </p>

          <div className="flex items-center justify-center space-x-4">
            <span className={`text-sm font-medium ${!isYearly ? "text-foreground" : "text-muted-foreground"}`}>
              Monthly
            </span>
            <Switch checked={isYearly} onCheckedChange={setIsYearly} className="data-[state=checked]:bg-primary" />
            <span className={`text-sm font-medium ${isYearly ? "text-foreground" : "text-muted-foreground"}`}>
              Yearly
            </span>
            <span className="text-sm bg-primary/10 text-primary px-2 py-1 rounded-full font-medium">Save 17%</span>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          {plans.map((plan) => {
            const Icon = plan.icon
            const price = isYearly ? plan.yearlyPrice : plan.monthlyPrice
            const period = isYearly ? "year" : "month"

            return (
              <Card key={plan.name} className={`relative flex flex-col ${plan.popular ? "border-primary shadow-lg scale-105" : ""}`}>
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                    <span className="bg-primary text-primary-foreground px-4 py-1 rounded-full text-sm font-medium">
                      Most Popular
                    </span>
                  </div>
                )}

                <CardHeader className="text-center pb-8">
                  <div className="mx-auto w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mb-4">
                    <Icon className="w-6 h-6 text-primary" />
                  </div>
                  <CardTitle className="text-2xl">{plan.name}</CardTitle>
                  <CardDescription className="text-balance">{plan.description}</CardDescription>
                  <div className="mt-4">
                    <span className="text-4xl font-bold">${price}</span>
                    <span className="text-muted-foreground">/{period}</span>
                  </div>
                </CardHeader>

                <CardContent className="flex-grow">
                  <ul className="space-y-3">
                    {plan.features.map((feature, index) => (
                      <li key={index} className="flex items-start space-x-3">
                        <Check className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                        <span className="text-sm">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>

                <CardFooter>
                  <Button className="w-full" variant={plan.popular ? "default" : "outline"} size="lg">
                    Get Started
                  </Button>
                </CardFooter>
              </Card>
            )
          })}
        </div>
      </div>
    </section>
  )
}