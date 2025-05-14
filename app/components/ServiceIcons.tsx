import React from "react";
import { 
  ApartmentCleaningIcon, 
  OfficeCleaningIcon, 
  WindowCleaningIcon, 
  AirbnbCleaningIcon,
  CleaningServicesIcon,
  DeepCleaningIcon,
  MaintenanceCleaningIcon,
  DisinfectionIcon
} from './Icons';

export const serviceIconMap: { [key: string]: React.FC<React.SVGProps<SVGSVGElement>> } = {
  "Čišćenje stanova": ApartmentCleaningIcon,
  "Čišćenje poslovnih prostora": OfficeCleaningIcon,
  "Čišćenje prozora": WindowCleaningIcon,
  "Airbnb čišćenje": AirbnbCleaningIcon,
  "Generalno čišćenje": CleaningServicesIcon,
  "Dubinsko čišćenje": DeepCleaningIcon,
  "Održavanje čistoće": MaintenanceCleaningIcon,
  "Dezinfekcija": DisinfectionIcon
}; 