
// ==========================================
// LIVE INBOX ARCHITECTURE
// ==========================================
let activeInboxContact = null;
let inboxRealtimeChannel = null;

async function initLiveInbox() {
  console.log("Initializing Live Inbox...");
  const contactListEl = document.getElementById('inbox-contact-list');
  const chatAreaEl = document.getElementById('inbox-chat-area');
  const emptyStateEl = document.getElementById('inbox-empty');
  
  if (!contactListEl) return;
  
  contactListEl.innerHTML = '<div style="padding:20px; text-align:center; color:#667781;">Loading contacts...</div>';
  
  // Show empty state by default
  if (chatAreaEl) chatAreaEl.style.display = 'none';
  if (emptyStateEl) emptyStateEl.style.display = 'flex';
  
  try {
    // Query leads for contacts
    const { data: leads, error } = await supabase
      .from('leads')
      .select('*')
      .eq('user_id', currentUser.id)
      .order('last_interaction_at', { ascending: false });
      
    if (error) throw error;
    
    renderInboxContacts(leads || []);
  } catch (err) {
    console.error("Error loading inbox contacts:", err);
    contactListEl.innerHTML = '<div style="padding:20px; text-align:center; color:red;">Failed to load contacts.</div>';
  }
}

function renderInboxContacts(leads) {
  const contactListEl = document.getElementById('inbox-contact-list');
  if (!contactListEl) return;
  
  contactListEl.innerHTML = '';
  
  if (leads.length === 0) {
    contactListEl.innerHTML = '<div style="padding:20px; text-align:center; color:#667781;">No active conversations yet.</div>';
    return;
  }
  
  leads.forEach(lead => {
    const el = document.createElement('div');
    el.className = 'wa-contact-item';
    el.style = 'display: flex; align-items: center; padding: 0 12px; cursor: pointer; transition: background 0.2s;';
    
    // Add hover effect
    el.onmouseover = () => el.style.background = '#f5f6f6';
    el.onmouseout = () => {
      if (activeInboxContact !== lead.customer_phone) el.style.background = 'transparent';
    };
    
    const timeStr = lead.last_interaction_at 
      ? new Date(lead.last_interaction_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})
      : '';
      
    const nameStr = lead.customer_name || lead.customer_phone;
    
    el.innerHTML = `
      <div class="avatar" style="width: 49px; height: 49px; background: #dfe5e7; margin-right: 15px; flex-shrink: 0; display:flex; align-items:center; justify-content:center; border-radius:50%; font-size:20px;">👤</div>
      <div style="flex: 1; border-bottom: 1px solid #f2f2f2; padding: 12px 0; display:flex; flex-direction:column; justify-content:center;">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <span style="font-size: 17px; color: #111b21;">${nameStr}</span>
          <span style="font-size: 12px; color: #667781;">${timeStr}</span>
        </div>
        <div style="font-size: 14px; color: #667781; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 200px;">
          Click to view messages...
        </div>
      </div>
    `;
    
    el.onclick = () => {
      // Clear previous active styles
      document.querySelectorAll('.wa-contact-item').forEach(item => item.style.background = 'transparent');
      el.style.background = '#f0f2f5';
      loadInboxChat(lead);
    };
    
    contactListEl.appendChild(el);
  });
}

async function loadInboxChat(lead) {
  activeInboxContact = lead.customer_phone;
  
  const chatAreaEl = document.getElementById('inbox-chat-area');
  const emptyStateEl = document.getElementById('inbox-empty');
  const activeContactEl = document.getElementById('inbox-active-contact');
  const historyEl = document.getElementById('inbox-history');
  const replyInput = document.getElementById('inbox-reply-input');
  
  if (chatAreaEl) chatAreaEl.style.display = 'flex';
  if (emptyStateEl) emptyStateEl.style.display = 'none';
  if (activeContactEl) activeContactEl.innerText = lead.customer_name || lead.customer_phone;
  if (replyInput) {
    replyInput.disabled = false;
    replyInput.placeholder = "Type a message";
  }
  
  if (historyEl) {
    historyEl.innerHTML = '<div style="text-align:center; padding:20px; color:#667781;">Loading messages...</div>';
  }
  
  try {
    // Fetch whatsapp_logs for this phone number
    const { data: logs, error } = await supabase
      .from('whatsapp_logs')
      .select('*')
      .eq('user_id', currentUser.id)
      .or(`from_number.eq.${lead.customer_phone},to_number.eq.${lead.customer_phone}`)
      .order('created_at', { ascending: true });
      
    if (error) throw error;
    
    renderChatHistory(logs || []);
    setupInboxRealtime(lead.customer_phone);
    
  } catch (err) {
    console.error("Error loading chat history:", err);
    if (historyEl) historyEl.innerHTML = '<div style="text-align:center; padding:20px; color:red;">Failed to load messages.</div>';
  }
}

function renderChatHistory(logs) {
  const historyEl = document.getElementById('inbox-history');
  if (!historyEl) return;
  
  historyEl.innerHTML = '<div style="align-self: center; background: white; padding: 5px 12px; border-radius: 8px; font-size: 12px; color: #54656f; box-shadow: 0 1px 0.5px rgba(11,20,26,.13); margin-bottom: 10px;">Chat History</div>';
  
  logs.forEach(log => {
    appendMessageBubble(log);
  });
  
  // Scroll to bottom
  historyEl.scrollTop = historyEl.scrollHeight;
}

function appendMessageBubble(log) {
  const historyEl = document.getElementById('inbox-history');
  if (!historyEl) return;
  
  const timeStr = new Date(log.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
  const isOutbound = log.direction === 'outbound';
  
  const bubble = document.createElement('div');
  bubble.className = isOutbound ? 'wa-bubble-sent' : 'wa-bubble-received';
  
  if (isOutbound) {
    bubble.style = 'align-self: flex-end; background: #d9fdd3; padding: 6px 7px 8px 9px; border-radius: 8px 0 8px 8px; max-width: 65%; box-shadow: 0 1px 0.5px rgba(11,20,26,.13); position: relative; font-size: 14.2px; color: #111b21; margin-bottom: 4px;';
    
    // Read receipts SVG
    const ticksSvg = log.status === 'read' 
      ? '<svg viewBox="0 0 16 15" width="16" height="15"><path fill="#53bdeb" d="M15.01 3.316l-.478-.372a.365.365 0 0 0-.51.063L8.666 9.879a.32.32 0 0 1-.484.033l-.358-.325a.319.319 0 0 0-.484.032l-.378.483a.418.418 0 0 0 .036.541l1.32 1.266c.143.14.361.125.484-.033l6.272-8.048a.366.366 0 0 0-.064-.512zm-4.1 0l-.478-.372a.365.365 0 0 0-.51.063L4.566 9.879a.32.32 0 0 1-.484.033L1.891 7.769a.366.366 0 0 0-.515.006l-.423.433a.364.364 0 0 0 .006.514l3.258 3.185c.143.14.361.125.484-.033l6.272-8.048a.365.365 0 0 0-.063-.51z"></path></svg>'
      : '<svg viewBox="0 0 16 15" width="16" height="15"><path fill="#8696a0" d="M15.01 3.316l-.478-.372a.365.365 0 0 0-.51.063L8.666 9.879a.32.32 0 0 1-.484.033l-.358-.325a.319.319 0 0 0-.484.032l-.378.483a.418.418 0 0 0 .036.541l1.32 1.266c.143.14.361.125.484-.033l6.272-8.048a.366.366 0 0 0-.064-.512z"></path></svg>';
      
    bubble.innerHTML = `
      ${log.message_body.replace(/\n/g, '<br>')}
      <span style="float: right; font-size: 11px; color: #667781; margin: 10px 0 -5px 10px; display:flex; align-items:center; gap:3px;">
        ${timeStr} ${ticksSvg}
      </span>
    `;
  } else {
    bubble.style = 'align-self: flex-start; background: #ffffff; padding: 6px 7px 8px 9px; border-radius: 0 8px 8px 8px; max-width: 65%; box-shadow: 0 1px 0.5px rgba(11,20,26,.13); position: relative; font-size: 14.2px; color: #111b21; margin-bottom: 4px;';
    bubble.innerHTML = `
      ${log.message_body.replace(/\n/g, '<br>')}
      <span style="float: right; font-size: 11px; color: #667781; margin: 10px 0 -5px 10px;">${timeStr}</span>
    `;
  }
  
  historyEl.appendChild(bubble);
}

function setupInboxRealtime(customerPhone) {
  // Remove existing channel if any
  if (inboxRealtimeChannel) {
    supabase.removeChannel(inboxRealtimeChannel);
  }
  
  inboxRealtimeChannel = supabase.channel('custom-inbox-channel')
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'whatsapp_logs', filter: `user_id=eq.${currentUser.id}` },
      (payload) => {
        const newLog = payload.new;
        // Check if the message belongs to the active contact
        if (newLog.from_number === activeInboxContact || newLog.to_number === activeInboxContact) {
          appendMessageBubble(newLog);
          const historyEl = document.getElementById('inbox-history');
          if (historyEl) historyEl.scrollTop = historyEl.scrollHeight;
        }
      }
    )
    .subscribe((status) => {
      console.log("Realtime Sync Status:", status);
    });
}

// Send Manual Message Logic
async function handleSendInboxMessage() {
  const replyInput = document.getElementById('inbox-reply-input');
  const messageBody = replyInput.value.trim();
  
  if (!messageBody || !activeInboxContact) return;
  
  // Clear input
  replyInput.value = '';
  
  // Optimistically render
  const tempLog = {
    direction: 'outbound',
    message_body: messageBody,
    created_at: new Date().toISOString(),
    status: 'sending'
  };
  appendMessageBubble(tempLog);
  const historyEl = document.getElementById('inbox-history');
  if (historyEl) historyEl.scrollTop = historyEl.scrollHeight;
  
  try {
    const { data: { session } } = await supabase.auth.getSession();
    
    // Call Edge Function
    const res = await fetch(`${supabaseUrl}/functions/v1/send-manual-message`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`
      },
      body: JSON.stringify({
        toPhone: activeInboxContact,
        messageBody: messageBody
      })
    });
    
    if (!res.ok) {
      const errorData = await res.json();
      throw new Error(errorData.error || "Failed to send");
    }
    
    // It was successful. Realtime will fetch the DB insert, we might see duplicates if we rely on optimistic.
    // For now it's fine.
    
  } catch (err) {
    console.error("Send message error:", err);
    alert("Failed to send message: " + err.message);
  }
}

// Setup Event Listeners for Inbox
setTimeout(() => {
  const sendBtn = document.getElementById('btn-inbox-send');
  const replyInput = document.getElementById('inbox-reply-input');
  
  if (sendBtn) {
    sendBtn.onclick = handleSendInboxMessage;
  }
  
  if (replyInput) {
    replyInput.addEventListener('keypress', function (e) {
      if (e.key === 'Enter') {
        handleSendInboxMessage();
      }
    });
  }
}, 2000);
