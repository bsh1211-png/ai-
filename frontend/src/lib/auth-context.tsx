"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api, getToken, setToken, type User } from "./api";

interface AuthState {
  user: User | null;
  loading: boolean;
  login: (token: string) => Promise<void>;
  logout: () => void;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    // 토큰이 없으면(=미로그인) 백엔드를 호출하지 않고 즉시 로그아웃 상태로 처리.
    // 그래야 첫 방문자가 백엔드 콜드스타트(~40초)를 기다리며 빈 화면을 보지 않고
    // 곧바로 로그인 화면을 볼 수 있다.
    if (!getToken()) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const me = await api.get<User>("/auth/me");
      setUser(me);
      // 초대 링크로 진입 후 로그인한 경우, 대기 중인 친구 초대를 자동 수락
      const pending = typeof window !== "undefined" ? window.localStorage.getItem("pending_invite") : null;
      if (pending) {
        window.localStorage.removeItem("pending_invite");
        api.post("/friends/accept", { code: pending }).catch(() => {});
      }
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 마운트 시 1회 로그인 상태 확인
    refresh();
  }, []);

  const login = async (token: string) => {
    setToken(token);
    await refresh();
  };

  const logout = () => {
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth는 AuthProvider 안에서만 사용 가능합니다");
  return ctx;
}
