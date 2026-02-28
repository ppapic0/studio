
'use client';

import Link from 'next/link';
import {
  Bell,
  Home,
  LineChart,
  Package2,
  Users,
  PanelLeft,
  Search,
  LogOut,
  Smartphone,
  Monitor
} from 'lucide-react';

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import Image from 'next/image';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { MainNav } from './main-nav';
import { useUser, useAuth } from '@/firebase';
import { signOut } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { useAppContext } from '@/contexts/app-context';
import { cn } from '@/lib/utils';

export function DashboardHeader() {
  const { user } = useUser();
  const auth = useAuth();
  const router = useRouter();
  const { viewMode, setViewMode } = useAppContext();

  const handleSignOut = async () => {
    if (!auth) return;
    await signOut(auth);
    router.push('/login');
  };

  const toggleViewMode = () => {
    setViewMode(viewMode === 'responsive' ? 'mobile' : 'responsive');
  };

  return (
    <header className={cn(
      "sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-background/80 backdrop-blur-sm px-4",
      viewMode === 'responsive' && "sm:static sm:h-auto sm:border-0 sm:bg-transparent sm:px-6"
    )}>
      {viewMode === 'responsive' && (
        <Sheet>
          <SheetTrigger asChild>
            <Button size="icon" variant="outline" className="md:hidden">
              <PanelLeft className="h-5 w-5" />
              <span className="sr-only">메뉴 열기</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="sm:max-w-xs">
            <MainNav isMobile={true} />
          </SheetContent>
        </Sheet>
      )}

      {viewMode === 'responsive' && (
        <Breadcrumb className="hidden md:flex">
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link href="#">대시보드</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>개요</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      )}

      <div className="relative ml-auto flex items-center gap-2">
        {/* View Mode Toggle */}
        <Button 
          variant="ghost" 
          size="icon" 
          className={cn(
            "rounded-full transition-all",
            viewMode === 'mobile' ? "bg-primary text-white" : "text-muted-foreground"
          )}
          onClick={toggleViewMode}
          title={viewMode === 'mobile' ? "데스크톱 모드로 전환" : "앱 모드 시뮬레이션"}
        >
          {viewMode === 'mobile' ? <Monitor className="h-5 w-5" /> : <Smartphone className="h-5 w-5" />}
        </Button>

        <Button variant="ghost" size="icon" className="rounded-full text-muted-foreground">
          <Bell className="h-5 w-5" />
          <span className="sr-only">알림 열기</span>
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              className="overflow-hidden rounded-full border-2"
            >
              <Avatar className="h-full w-full">
                {user?.photoURL && <AvatarImage src={user.photoURL} alt={user.displayName || ''} />}
                <AvatarFallback>{user?.displayName?.charAt(0) || 'U'}</AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="rounded-2xl border-none shadow-2xl">
            <DropdownMenuLabel className="font-black">내 계정</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="font-bold">설정</DropdownMenuItem>
            <DropdownMenuItem className="font-bold">지원</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleSignOut} className="font-black text-destructive">
              <LogOut className="mr-2 h-4 w-4" />
              로그아웃
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
