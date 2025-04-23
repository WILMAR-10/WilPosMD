import React from "react";

export interface BadgeProps {
  variant?: "default" | "outline" | "destructive";
  className?: string;
  children: React.ReactNode;
}

const Badge: React.FC<BadgeProps> = ({ variant = "default", className, children }) => {
  let variantClasses = "";
  if (variant === "outline") variantClasses = "border border-gray-300 text-gray-700";
  else if (variant === "destructive") variantClasses = "bg-red-600 text-white";
  else variantClasses = "bg-gray-200 text-gray-800";
  return (
    <span className={`px-2 py-1 rounded-full text-xs ${variantClasses} ${className}`}>
      {children}
    </span>
  );
};

export default Badge;
