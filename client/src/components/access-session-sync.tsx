import {useEffect,useRef} from 'react';
import {useAuth} from '@/hooks/use-auth';
import {queryClient} from '@/lib/queryClient';
import {accessSessionKey,resetAccessQueries,subscribeAccessChanges} from '@/lib/access-session';

export function AccessSessionSync() {
  const {user,isLoading}=useAuth();
  const previous=useRef<string>();
  useEffect(()=>subscribeAccessChanges(()=>{
    void queryClient.invalidateQueries({queryKey:['/api/me']});
    void resetAccessQueries(queryClient);
  }),[]);
  useEffect(()=>{
    if(isLoading) return;
    const key=accessSessionKey(user);
    const changed=previous.current!==undefined&&previous.current!==key;
    previous.current=key;
    if(changed) void resetAccessQueries(queryClient);
  },[user,isLoading]);
  return null;
}
