"use client";

import React, { useEffect, useCallback } from "react";
import {
  X,
  Check,
  ArrowSquareOut,
  Star,
  HardDrives,
} from '@phosphor-icons/react';
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export interface VPSProvider {
  id: string;
  name: string;
  tagline: string;
  price: string;
  period: string;
  features: string[];
  signupUrl: string;
  color: string;
  recommended?: boolean;
}

export const VPS_PROVIDERS: VPSProvider[] = [
  {
    id: "hetzner",
    name: "Hetzner Cloud",
    tagline: "High-performance German cloud servers",
    price: "€4.51",
    period: "month",
    features: [
      "NVMe SSDs",
      "Unlimited traffic",
      "DDoS protection",
      "Nuremberg/Falkenstein/Hillsboro",
    ],
    signupUrl: "https://www.hetzner.com/cloud/",
    color: "#d50c2d",
    recommended: true,
  },
  {
    id: "digitalocean",
    name: "DigitalOcean",
    tagline: "Developer-friendly cloud infrastructure",
    price: "$6.00",
    period: "month",
    features: [
      "Simple pricing",
      "Kubernetes",
      "Managed databases",
      "Global regions",
    ],
    signupUrl: "https://www.digitalocean.com/pricing/",
    color: "#0069ff",
    recommended: false,
  },
  {
    id: "aws",
    name: "Amazon EC2",
    tagline: "Enterprise-grade cloud platform",
    price: "$7.59",
    period: "month",
    features: [
      "175+ services",
      "Global infrastructure",
      "Enterprise SLA",
      "Free tier",
    ],
    signupUrl: "https://aws.amazon.com/ec2/pricing/",
    color: "#ff9900",
    recommended: false,
  },
  {
    id: "contabo",
    name: "Contabo",
    tagline: "Budget-friendly VPS with generous resources",
    price: "€5.50",
    period: "month",
    features: [
      "Large storage included",
      "Unlimited traffic",
      "DDoS protection",
      "German/US/Singapore",
    ],
    signupUrl: "https://contabo.com/en/vps/",
    color: "#00a4e0",
    recommended: false,
  },
  {
    id: "racknerd",
    name: "RackNerd",
    tagline: "Affordable KVM VPS with frequent deals",
    price: "$10.98",
    period: "year",
    features: [
      "KVM virtualization",
      "SolusVM panel",
      "Multiple US locations",
      "DDoS protected",
    ],
    signupUrl: "https://www.racknerd.com/kvm-vps/",
    color: "#00c853",
    recommended: false,
  },
];

export interface VPSMarketplaceProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectProvider?: (providerId: string) => void;
  onConnectExisting?: () => void;
}

// Provider card component
interface ProviderCardProps {
  provider: VPSProvider;
  onSelect: (provider: VPSProvider) => void;
  index: number;
}

const ProviderCard: React.FC<ProviderCardProps> = ({
  provider,
  onSelect,
  index,
}) => {
  const getInitial = (name: string) => name.charAt(0).toUpperCase();

  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-xl",
        "bg-[#141414] border border-[#2a2a2a]",
        "transition-all duration-300 ease-out",
        "hover:border-[#3a3a3a] hover:bg-[#1a1a1a]",
        "hover:shadow-lg hover:shadow-black/20",
        "hover:-translate-y-1",
        "animate-in fade-in slide-in-from-bottom-4",
      )}
      style={{
        animationDelay: `${index * 75}ms`,
        animationFillMode: "both",
      }}
    >
      {/* Left border accent */}
      <div
        className="absolute left-0 top-0 bottom-0 w-1 transition-all duration-300 group-hover:w-1.5"
        style={{ backgroundColor: provider.color }}
      />

      <div className="p-5 pl-6">
        {/* Header with icon and badge */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            {/* Provider initial circle */}
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold text-sm transition-transform duration-300 group-hover:scale-110"
              style={{ backgroundColor: provider.color }}
            >
              {getInitial(provider.name)}
            </div>
            <div>
              <h3 className="text-white font-semibold text-base leading-tight">
                {provider.name}
              </h3>
              {provider.recommended && (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-yellow-400 mt-0.5">
                  <Star className="w-3 h-3 fill-yellow-400" />
                  Recommended
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Tagline */}
        <p className="text-[#a0a0a0] text-sm mb-4 line-clamp-2">
          {provider.tagline}
        </p>

        {/* Price */}
        <div className="mb-4">
          <span className="text-2xl font-bold text-white">{provider.price}</span>
          <span className="text-[#808080] text-sm ml-1">/{provider.period}</span>
        </div>

        {/* Features list */}
        <ul className="space-y-2 mb-5">
          {provider.features.map((feature) => (
            <li
              key={feature}
              className="flex items-center gap-2 text-sm text-[#b0b0b0]"
            >
              <Check
                className="w-4 h-4 flex-shrink-0"
                style={{ color: provider.color }}
              />
              <span className="line-clamp-1">{feature}</span>
            </li>
          ))}
        </ul>

        {/* CTA Button */}
        <Button
          onClick={() => onSelect(provider)}
          className={cn(
            "w-full group/btn relative overflow-hidden",
            "text-white font-medium",
            "transition-all duration-300",
            "hover:shadow-lg"
          )}
          style={{
            backgroundColor: provider.color,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.filter = "brightness(1.1)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.filter = "brightness(1)";
          }}
        >
          <span className="relative z-10 flex items-center justify-center gap-2">
            Get Started
            <ArrowSquareOut className="w-4 h-4 transition-transform duration-300 group-hover/btn:translate-x-0.5 group-hover/btn:-translate-y-0.5" />
          </span>
        </Button>
      </div>
    </div>
  );
};

export const VPSMarketplace: React.FC<VPSMarketplaceProps> = ({
  isOpen,
  onClose,
  onSelectProvider,
  onConnectExisting,
}) => {
  // Handle ESC key
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    },
    [isOpen, onClose]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  const handleProviderSelect = (provider: VPSProvider) => {
    onSelectProvider?.(provider.id);
    window.open(provider.signupUrl, "_blank", "noopener,noreferrer");
  };

  const handleConnectExisting = () => {
    onConnectExisting?.();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 flex items-center justify-center",
        "animate-in fade-in duration-300"
      )}
      style={{ backgroundColor: "rgba(10, 10, 10, 0.95)" }}
      onClick={onClose}
    >
      {/* Modal Content */}
      <div
        className={cn(
          "relative w-full max-w-[900px] max-h-[90vh] mx-4",
          "bg-[#0f0f0f] rounded-2xl border border-[#2a2a2a]",
          "shadow-2xl shadow-black/50",
          "overflow-hidden",
          "animate-in zoom-in-95 slide-in-from-bottom-8 duration-300"
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className={cn(
            "absolute top-4 right-4 z-10",
            "w-9 h-9 rounded-lg flex items-center justify-center",
            "bg-[#1a1a1a] text-[#a0a0a0]",
            "border border-[#2a2a2a]",
            "transition-all duration-200",
            "hover:bg-[#252525] hover:text-white hover:border-[#3a3a3a]",
            "focus:outline-none focus:ring-2 focus:ring-[#3a3a3a]"
          )}
          aria-label="Close"
        >
          <X size={20} />
        </button>

        {/* Header */}
        <div className="px-8 pt-8 pb-6 border-b border-[#2a2a2a]">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-blue-500/30 flex items-center justify-center">
              <HardDrives className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">
                Choose Your VPS Provider
              </h2>
            </div>
          </div>
          <p className="text-[#a0a0a0] text-base max-w-xl">
            Select a cloud provider to deploy your infrastructure. All providers
            offer reliable VPS hosting with competitive pricing.
          </p>
        </div>

        {/* Scrollable Content */}
        <div className="overflow-y-auto max-h-[calc(90vh-200px)] custom-scrollbar">
          <div className="p-8">
            {/* Provider Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {VPS_PROVIDERS.map((provider, index) => (
                <ProviderCard
                  key={provider.id}
                  provider={provider}
                  onSelect={handleProviderSelect}
                  index={index}
                />
              ))}
            </div>

            {/* Bottom CTA */}
            <div className="mt-8 pt-6 border-t border-[#2a2a2a]">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="text-center sm:text-left">
                  <p className="text-[#808080] text-sm">
                    Already have a VPS or want to use a different provider?
                  </p>
                </div>
                <Button
                  variant="outline"
                  onClick={handleConnectExisting}
                  className={cn(
                    "border-[#3a3a3a] bg-transparent text-white",
                    "hover:bg-[#1a1a1a] hover:border-[#4a4a4a]",
                    "transition-all duration-200"
                  )}
                >
                  Connect Existing VPS
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Custom scrollbar styles injected via useEffect */}
    </div>
  );
};

export default VPSMarketplace;
