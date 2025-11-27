import React, { useState, useEffect } from 'react';
import { db } from './firebase';
import { ref, onValue, set, push, get } from 'firebase/database';

export default function UpSystem() {
  // Setup state
  const [isLoading, setIsLoading] = useState(true);
  const [isSetupComplete, setIsSetupComplete] = useState(false);
  const [setupStep, setSetupStep] = useState(1);
  const [repCount, setRepCount] = useState(5);
  const [repNames, setRepNames] = useState([]);
  
  // App state (synced with Firebase)
  const [reps, setReps] = useState([]);
  const [queue, setQueue] = useState([]);
  const [steppedAway, setSteppedAway] = useState([]);
  const [withCustomer, setWithCustomer] = useState([]);
  const [history, setHistory] = useState([]);
  const [view, setView] = useState('home');
  const [currentTime, setCurrentTime] = useState(new Date());

  // Update clock
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Subscribe to Firebase data
  useEffect(() => {
    const storeRef = ref(db, 'store');
    
    const unsubscribe = onValue(storeRef, (snapshot) => {
      const data = snapshot.val();
      
      if (data) {
        setReps(data.reps || []);
        setQueue(data.queue || []);
        setSteppedAway(data.steppedAway || []);
        setWithCustomer(data.withCustomer || []);
        setHistory(data.history || []);
        setIsSetupComplete(data.isSetupComplete || false);
      }
      
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Initialize rep names array when count changes
  useEffect(() => {
    setRepNames(prev => {
      const newNames = [...prev];
      while (newNames.length < repCount) {
        newNames.push('');
      }
      return newNames.slice(0, repCount);
    });
  }, [repCount]);

  // Firebase update helper
  const updateStore = async (updates) => {
    const storeRef = ref(db, 'store');
    const snapshot = await get(storeRef);
    const currentData = snapshot.val() || {};
    await set(storeRef, { ...currentData, ...updates });
  };

  // Complete setup and create reps
  const completeSetup = async () => {
    const validNames = repNames.filter(name => name.trim() !== '');
    if (validNames.length === 0) return;
    
    const newReps = validNames.map((name, index) => ({
      id: index + 1,
      name: name.trim(),
      avatar: name.trim().charAt(0).toUpperCase()
    }));
    
    await updateStore({
      reps: newReps,
      queue: [],
      steppedAway: [],
      withCustomer: [],
      history: [],
      isSetupComplete: true
    });
  };

  // Reset the system (for new day/shift)
  const resetSystem = async () => {
    if (window.confirm('This will clear all data and start fresh. Are you sure?')) {
      await set(ref(db, 'store'), null);
      setRepNames([]);
      setSetupStep(1);
    }
  };

  // Add a new rep to the schedule
  const addNewRep = async (name) => {
    if (!name.trim()) return;
    const newRep = {
      id: Date.now(),
      name: name.trim(),
      avatar: name.trim().charAt(0).toUpperCase()
    };
    await updateStore({ reps: [...reps, newRep] });
  };

  // Remove a rep from the schedule entirely
  const removeRep = async (repId) => {
    const rep = reps.find(r => r.id === repId);
    if (!window.confirm(`Remove ${rep?.name} from today's schedule?`)) return;
    
    const newReps = reps.filter(r => r.id !== repId);
    const newQueue = queue.filter(id => id !== repId);
    const newSteppedAway = steppedAway.filter(id => id !== repId);
    const newWithCustomer = withCustomer.filter(id => id !== repId);
    
    await updateStore({ 
      reps: newReps,
      queue: newQueue, 
      steppedAway: newSteppedAway, 
      withCustomer: newWithCustomer 
    });
  };

  // Clear day - reset queue but keep reps on schedule
  const clearDay = async () => {
    if (!window.confirm('Clear all check-ins and start fresh? (Reps will stay on the schedule)')) return;
    
    await updateStore({ 
      queue: [], 
      steppedAway: [], 
      withCustomer: [],
      history: []
    });
  };

  // Check a rep into the queue
  const checkInRep = async (repId) => {
    if (!queue.includes(repId)) {
      const newQueue = [...queue, repId];
      const newHistory = [{
        id: Date.now(),
        repId,
        repName: reps.find(r => r.id === repId)?.name || 'Unknown',
        action: 'checked_in',
        timestamp: new Date().toISOString()
      }, ...history];
      await updateStore({ queue: newQueue, history: newHistory });
    }
  };

  // Check a rep out of the queue
  const checkOutRep = async (repId) => {
    const newQueue = queue.filter(id => id !== repId);
    const newSteppedAway = steppedAway.filter(id => id !== repId);
    const newWithCustomer = withCustomer.filter(id => id !== repId);
    const newHistory = [{
      id: Date.now(),
      repId,
      repName: reps.find(r => r.id === repId)?.name || 'Unknown',
      action: 'checked_out',
      timestamp: new Date().toISOString()
    }, ...history];
    await updateStore({ 
      queue: newQueue, 
      steppedAway: newSteppedAway, 
      withCustomer: newWithCustomer,
      history: newHistory 
    });
  };

  // Get active queue (excluding stepped away AND with customer)
  const activeQueue = queue.filter(id => !steppedAway.includes(id) && !withCustomer.includes(id));
  const upRep = activeQueue.length > 0 ? reps.find(r => r.id === activeQueue[0]) : null;

  // Take a customer (for the rep who is "up" - marks them as with customer)
  const takeCustomer = async (repId) => {
    if (activeQueue[0] === repId) {
      // Mark them as with customer (same as markWithCustomer)
      const newWithCustomer = [...withCustomer, repId];
      const newHistory = [{
        id: Date.now(),
        repId,
        repName: reps.find(r => r.id === repId)?.name || 'Unknown',
        action: 'took_customer',
        timestamp: new Date().toISOString()
      }, ...history];
      await updateStore({ 
        withCustomer: newWithCustomer, 
        history: newHistory 
      });
    }
  };

  // Mark any rep as being with a customer
  const markWithCustomer = async (repId) => {
    const newWithCustomer = [...withCustomer, repId];
    const newSteppedAway = steppedAway.filter(id => id !== repId);
    const newHistory = [{
      id: Date.now(),
      repId,
      repName: reps.find(r => r.id === repId)?.name || 'Unknown',
      action: 'with_customer',
      timestamp: new Date().toISOString()
    }, ...history];
    await updateStore({ 
      withCustomer: newWithCustomer, 
      steppedAway: newSteppedAway,
      history: newHistory 
    });
  };

  // Mark rep as finished with customer
  const finishedWithCustomer = async (repId) => {
    const newWithCustomer = withCustomer.filter(id => id !== repId);
    const newQueue = queue.filter(id => id !== repId);
    newQueue.push(repId);
    const newHistory = [{
      id: Date.now(),
      repId,
      repName: reps.find(r => r.id === repId)?.name || 'Unknown',
      action: 'finished_customer',
      timestamp: new Date().toISOString()
    }, ...history];
    await updateStore({ 
      withCustomer: newWithCustomer, 
      queue: newQueue,
      history: newHistory 
    });
  };

  // Toggle stepped away status
  const toggleStepAway = async (repId) => {
    if (queue.includes(repId)) {
      let newSteppedAway;
      let action;
      if (steppedAway.includes(repId)) {
        newSteppedAway = steppedAway.filter(id => id !== repId);
        action = 'returned';
      } else {
        newSteppedAway = [...steppedAway, repId];
        action = 'stepped_away';
      }
      const newHistory = [{
        id: Date.now(),
        repId,
        repName: reps.find(r => r.id === repId)?.name || 'Unknown',
        action,
        timestamp: new Date().toISOString()
      }, ...history];
      await updateStore({ steppedAway: newSteppedAway, history: newHistory });
    }
  };

  // Calculate stats
  const getStats = () => {
    const customersTaken = {};
    
    reps.forEach(rep => {
      customersTaken[rep.id] = 0;
    });

    history.forEach(event => {
      if (event.action === 'took_customer' || event.action === 'finished_customer') {
        customersTaken[event.repId] = (customersTaken[event.repId] || 0) + 1;
      }
    });

    return reps.map(rep => ({
      ...rep,
      customersTaken: customersTaken[rep.id] || 0,
      isActive: queue.includes(rep.id),
      isSteppedAway: steppedAway.includes(rep.id),
      isWithCustomer: withCustomer.includes(rep.id)
    })).sort((a, b) => b.customersTaken - a.customersTaken);
  };

  const formatTime = (date) => {
    if (typeof date === 'string') {
      date = new Date(date);
    }
    return date.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    });
  };

  const formatAction = (action) => {
    const actions = {
      'checked_in': 'Checked in',
      'checked_out': 'Checked out',
      'took_customer': 'Took customer',
      'stepped_away': 'Stepped away',
      'returned': 'Returned',
      'with_customer': 'Helping customer',
      'finished_customer': 'Finished with customer'
    };
    return actions[action] || action;
  };

  const getActionColor = (action) => {
    const colors = {
      'checked_in': '#22c55e',
      'checked_out': '#ef4444',
      'took_customer': '#3b82f6',
      'stepped_away': '#f59e0b',
      'returned': '#22c55e',
      'with_customer': '#8b5cf6',
      'finished_customer': '#22c55e'
    };
    return colors[action] || '#6b7280';
  };

  // Loading screen
  if (isLoading) {
    return (
      <div style={styles.container}>
        <div style={styles.loadingScreen}>
          <div style={styles.logoMark}>↑</div>
          <p style={styles.loadingText}>Loading...</p>
        </div>
      </div>
    );
  }

  // Setup Screen - Step 1: How many reps?
  if (!isSetupComplete && setupStep === 1) {
    return (
      <div style={styles.container}>
        <div style={styles.setupHeader}>
          <div style={styles.logoMark}>↑</div>
          <h1 style={styles.logoText}>UP SYSTEM</h1>
          <p style={styles.setupSubtitle}>Let's set up your shift</p>
        </div>
        
        <div style={styles.setupCard}>
          <div style={styles.setupLabel}>How many reps are working today?</div>
          
          <div style={styles.counterContainer}>
            <button 
              onClick={() => setRepCount(Math.max(1, repCount - 1))}
              style={styles.counterButton}
            >
              −
            </button>
            <div style={styles.counterValue}>{repCount}</div>
            <button 
              onClick={() => setRepCount(Math.min(15, repCount + 1))}
              style={styles.counterButton}
            >
              +
            </button>
          </div>
          
          <p style={styles.setupHint}>You can always add more reps later</p>
        </div>

        <button 
          onClick={() => setSetupStep(2)}
          style={styles.setupButton}
        >
          NEXT →
        </button>
      </div>
    );
  }

  // Setup Screen - Step 2: Enter names
  if (!isSetupComplete && setupStep === 2) {
    const filledNames = repNames.filter(n => n.trim() !== '').length;
    
    return (
      <div style={styles.container}>
        <div style={styles.setupHeaderSmall}>
          <button onClick={() => setSetupStep(1)} style={styles.backButton}>
            ← Back
          </button>
          <div style={styles.logoSmall}>↑</div>
          <div style={styles.setupProgress}>{filledNames} of {repCount} reps</div>
        </div>
        
        <div style={styles.setupCard}>
          <div style={styles.setupLabel}>Enter rep names</div>
          
          <div style={styles.nameInputList}>
            {repNames.map((name, index) => (
              <div key={index} style={styles.nameInputRow}>
                <div style={styles.nameInputNumber}>{index + 1}</div>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => {
                    const newNames = [...repNames];
                    newNames[index] = e.target.value;
                    setRepNames(newNames);
                  }}
                  placeholder={`Rep ${index + 1} name`}
                  style={styles.nameInput}
                />
                {name && (
                  <div style={styles.nameInputAvatar}>
                    {name.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <button 
          onClick={completeSetup}
          disabled={filledNames === 0}
          style={{
            ...styles.setupButton,
            ...(filledNames === 0 ? styles.setupButtonDisabled : {})
          }}
        >
          START SHIFT →
        </button>
      </div>
    );
  }

  // Main App
  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.headerLeft}>
          <div style={styles.logoSmall}>↑</div>
          <div>
            <div style={styles.userName}>Up System</div>
            <div style={styles.userStatus}>
              {queue.length} of {reps.length} reps checked in
            </div>
          </div>
        </div>
        <div style={styles.headerRight}>
          <div style={styles.clock}>{formatTime(currentTime)}</div>
          <button onClick={resetSystem} style={styles.resetButton}>
            Reset
          </button>
        </div>
      </div>

      {/* Who's Up Banner */}
      {upRep && (
        <div style={styles.upBanner}>
          <div style={styles.upBannerContent}>
            <span style={styles.upBannerIcon}>★</span>
            <span style={styles.upBannerText}>{upRep.name.toUpperCase()} IS UP</span>
            <span style={styles.upBannerIcon}>★</span>
          </div>
        </div>
      )}

      {/* Navigation */}
      <div style={styles.nav}>
        <button 
          onClick={() => setView('home')} 
          style={{...styles.navButton, ...(view === 'home' ? styles.navButtonActive : {})}}
        >
          Home
        </button>
        <button 
          onClick={() => setView('queue')} 
          style={{...styles.navButton, ...(view === 'queue' ? styles.navButtonActive : {})}}
        >
          Queue ({activeQueue.length})
        </button>
        <button 
          onClick={() => setView('stats')} 
          style={{...styles.navButton, ...(view === 'stats' ? styles.navButtonActive : {})}}
        >
          Stats
        </button>
        <button 
          onClick={() => setView('history')} 
          style={{...styles.navButton, ...(view === 'history' ? styles.navButtonActive : {})}}
        >
          History
        </button>
      </div>

      {/* Content */}
      <div style={styles.content}>
        {/* HOME TAB */}
        {view === 'home' && (
          <div style={styles.homeContainer}>
            <div style={styles.homeHeader}>
              <div style={styles.homeTitle}>Today's Schedule</div>
              <div style={styles.homeCount}>{reps.length} reps</div>
            </div>

            <div style={styles.homeGrid}>
              {reps.map(rep => {
                const isCheckedIn = queue.includes(rep.id);
                const isAway = steppedAway.includes(rep.id);
                const isBusy = withCustomer.includes(rep.id);
                const position = activeQueue.indexOf(rep.id) + 1;
                const isUp = activeQueue[0] === rep.id;
                
                return (
                  <div 
                    key={rep.id} 
                    style={{
                      ...styles.homeCard,
                      ...(isCheckedIn && !isAway && !isBusy ? styles.homeCardCheckedIn : {}),
                      ...(isUp && !isAway && !isBusy ? styles.homeCardUp : {}),
                      ...(isBusy ? styles.homeCardBusy : {}),
                      ...(isAway ? styles.homeCardAway : {})
                    }}
                  >
                    <div style={{
                      ...styles.homeAvatar,
                      ...(isCheckedIn && !isAway && !isBusy ? styles.homeAvatarCheckedIn : {}),
                      ...(isUp && !isAway && !isBusy ? styles.homeAvatarUp : {}),
                      ...(isBusy ? styles.homeAvatarBusy : {}),
                      ...(isAway ? styles.homeAvatarAway : {})
                    }}>
                      {rep.avatar}
                    </div>
                    <div style={styles.homeCardInfo}>
                      <div style={styles.homeCardName}>{rep.name}</div>
                      <div style={styles.homeCardStatus}>
                        {!isCheckedIn ? (
                          <span style={styles.statusNotIn}>Not checked in</span>
                        ) : isBusy ? (
                          <span style={styles.statusBusy}>● With customer</span>
                        ) : isAway ? (
                          <span style={styles.statusAway}>⏸ Stepped away</span>
                        ) : isUp ? (
                          <span style={styles.statusUp}>★ UP NOW</span>
                        ) : (
                          <span style={styles.statusQueue}>#{position} in queue</span>
                        )}
                      </div>
                    </div>
                    <div style={styles.homeCardActions}>
                      {!isCheckedIn ? (
                        <>
                          <button 
                            onClick={() => checkInRep(rep.id)}
                            style={styles.checkInButton}
                          >
                            Check In
                          </button>
                          <button 
                            onClick={() => removeRep(rep.id)}
                            style={styles.removeRepButton}
                            title="Remove from schedule"
                          >
                            ✕
                          </button>
                        </>
                      ) : (
                        <button 
                          onClick={() => checkOutRep(rep.id)}
                          style={styles.checkOutButton}
                        >
                          Check Out
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={styles.addRepSectionInline}>
              <AddRepForm onAdd={addNewRep} />
            </div>

            {/* Clear Day Button */}
            <div style={styles.clearDaySection}>
              <button onClick={clearDay} style={styles.clearDayButton}>
                Clear Day
              </button>
              <p style={styles.clearDayHint}>Reset all check-ins and start fresh</p>
            </div>
          </div>
        )}

        {/* QUEUE TAB */}
        {view === 'queue' && (
          <div style={styles.queueContainer}>
            {activeQueue.length === 0 && queue.length === 0 && withCustomer.length === 0 ? (
              <div style={styles.emptyState}>
                <div style={styles.emptyIcon}>∅</div>
                <p>No reps checked in yet</p>
                <p style={styles.emptyHint}>Check in reps from the Home tab</p>
              </div>
            ) : (
              <>
                {/* With Customer Section */}
                {withCustomer.length > 0 && (
                  <div style={styles.withCustomerSection}>
                    <div style={styles.withCustomerTitle}>With Customer</div>
                    {withCustomer.map(repId => {
                      const rep = reps.find(r => r.id === repId);
                      if (!rep) return null;
                      return (
                        <div key={repId} style={styles.withCustomerItem}>
                          <div style={styles.withCustomerAvatar}>{rep.avatar}</div>
                          <span style={styles.withCustomerName}>{rep.name}</span>
                          <button 
                            onClick={() => finishedWithCustomer(repId)}
                            style={styles.finishedButton}
                          >
                            Finished
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Active Queue */}
                {activeQueue.length > 0 && (
                  <div style={styles.queueList}>
                    <div style={styles.queueSectionTitle}>In Queue</div>
                    {activeQueue.map((repId, index) => {
                      const rep = reps.find(r => r.id === repId);
                      const isFirst = index === 0;
                      return (
                        <div 
                          key={repId} 
                          style={{
                            ...styles.queueItem,
                            ...(isFirst ? styles.queueItemUp : {})
                          }}
                        >
                          <div style={styles.queuePosition}>{index + 1}</div>
                          <div style={{
                            ...styles.queueAvatar,
                            ...(isFirst ? styles.queueAvatarUp : {})
                          }}>
                            {rep?.avatar}
                          </div>
                          <div style={styles.queueInfo}>
                            <div style={styles.queueName}>{rep?.name}</div>
                            {isFirst && <div style={styles.queueUpLabel}>UP NOW</div>}
                          </div>
                          <div style={styles.queueActions}>
                            {isFirst ? (
                              <button 
                                onClick={() => takeCustomer(repId)}
                                style={styles.tookCustomerButton}
                              >
                                Took Customer
                              </button>
                            ) : (
                              <button 
                                onClick={() => markWithCustomer(repId)}
                                style={styles.withCustomerButton}
                              >
                                With Customer
                              </button>
                            )}
                            <button 
                              onClick={() => toggleStepAway(repId)}
                              style={styles.stepAwayButton}
                            >
                              Step Away
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
                
                {/* Stepped Away Section */}
                {steppedAway.length > 0 && (
                  <div style={styles.awaySection}>
                    <div style={styles.awaySectionTitle}>Stepped Away</div>
                    {steppedAway.map(repId => {
                      const rep = reps.find(r => r.id === repId);
                      if (!rep) return null;
                      return (
                        <div key={repId} style={styles.awayItem}>
                          <div style={styles.awayAvatar}>{rep.avatar}</div>
                          <span style={styles.awayName}>{rep.name}</span>
                          <button 
                            onClick={() => toggleStepAway(repId)}
                            style={styles.returnButtonSmall}
                          >
                            Return
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* STATS TAB */}
        {view === 'stats' && (
          <div style={styles.statsList}>
            <div style={styles.statsHeader}>
              <span>Today's Performance</span>
            </div>
            {getStats().map((rep, index) => (
              <div key={rep.id} style={styles.statsItem}>
                <div style={styles.statsRank}>
                  {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `#${index + 1}`}
                </div>
                <div style={styles.statsAvatar}>{rep.avatar}</div>
                <div style={styles.statsInfo}>
                  <div style={styles.statsName}>{rep.name}</div>
                  <div style={styles.statsStatus}>
                    {rep.isWithCustomer ? '● Busy' : rep.isActive ? (rep.isSteppedAway ? '⏸ Away' : '● Active') : '○ Off'}
                  </div>
                </div>
                <div style={styles.statsCount}>
                  <div style={styles.statsNumber}>{rep.customersTaken}</div>
                  <div style={styles.statsLabel}>customers</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* HISTORY TAB */}
        {view === 'history' && (
          <div style={styles.historyList}>
            {history.length === 0 ? (
              <div style={styles.emptyState}>
                <div style={styles.emptyIcon}>📋</div>
                <p>No activity yet</p>
              </div>
            ) : (
              history.slice(0, 50).map(event => (
                <div key={event.id} style={styles.historyItem}>
                  <div style={styles.historyTime}>{formatTime(event.timestamp)}</div>
                  <div style={styles.historyDot}>
                    <span style={{
                      ...styles.historyDotInner,
                      backgroundColor: getActionColor(event.action)
                    }}></span>
                  </div>
                  <div style={styles.historyContent}>
                    <span style={styles.historyName}>{event.repName}</span>
                    <span style={styles.historyAction}>{formatAction(event.action)}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Add Rep Form Component
function AddRepForm({ onAdd }) {
  const [name, setName] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  const handleSubmit = () => {
    if (name.trim()) {
      onAdd(name);
      setName('');
      setIsOpen(false);
    }
  };

  if (!isOpen) {
    return (
      <button onClick={() => setIsOpen(true)} style={styles.addRepButton}>
        + Add another rep
      </button>
    );
  }

  return (
    <div style={styles.addRepForm}>
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Enter name"
        style={styles.addRepInput}
        autoFocus
        onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
      />
      <button onClick={handleSubmit} style={styles.addRepSubmit}>Add</button>
      <button onClick={() => setIsOpen(false)} style={styles.addRepCancel}>✕</button>
    </div>
  );
}

const styles = {
  container: {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
    fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif",
    color: '#f8fafc',
    paddingBottom: '2rem',
  },
  
  // Loading styles
  loadingScreen: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
  },
  loadingText: {
    color: '#64748b',
    marginTop: '1rem',
  },
  
  // Setup styles
  setupHeader: {
    textAlign: 'center',
    padding: '3rem 1.5rem 2rem',
  },
  setupHeaderSmall: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '1rem 1.5rem',
    borderBottom: '1px solid rgba(255,255,255,0.05)',
  },
  backButton: {
    background: 'none',
    border: 'none',
    color: '#64748b',
    fontSize: '0.875rem',
    cursor: 'pointer',
  },
  setupProgress: {
    fontSize: '0.875rem',
    color: '#22d3ee',
  },
  setupSubtitle: {
    color: '#64748b',
    marginTop: '1rem',
    fontSize: '1rem',
  },
  setupCard: {
    margin: '1.5rem',
    padding: '2rem',
    background: 'rgba(255,255,255,0.03)',
    borderRadius: '20px',
    border: '1px solid rgba(255,255,255,0.05)',
  },
  setupLabel: {
    fontSize: '1.125rem',
    fontWeight: '600',
    marginBottom: '1.5rem',
    textAlign: 'center',
  },
  counterContainer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '1.5rem',
  },
  counterButton: {
    width: '56px',
    height: '56px',
    borderRadius: '50%',
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.1)',
    color: '#f8fafc',
    fontSize: '1.5rem',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  counterValue: {
    fontSize: '4rem',
    fontWeight: '700',
    width: '100px',
    textAlign: 'center',
    background: 'linear-gradient(135deg, #22d3ee 0%, #0891b2 100%)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
  },
  setupHint: {
    textAlign: 'center',
    color: '#64748b',
    fontSize: '0.875rem',
    marginTop: '1.5rem',
  },
  setupButton: {
    display: 'block',
    width: 'calc(100% - 3rem)',
    margin: '1.5rem',
    padding: '1.25rem',
    background: 'linear-gradient(135deg, #22d3ee 0%, #0891b2 100%)',
    border: 'none',
    borderRadius: '16px',
    color: '#0f172a',
    fontSize: '1rem',
    fontWeight: '700',
    letterSpacing: '0.05em',
    cursor: 'pointer',
  },
  setupButtonDisabled: {
    opacity: 0.3,
    cursor: 'not-allowed',
  },
  nameInputList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
  },
  nameInputRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
  },
  nameInputNumber: {
    width: '28px',
    height: '28px',
    borderRadius: '50%',
    background: 'rgba(255,255,255,0.05)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '0.75rem',
    color: '#64748b',
    flexShrink: 0,
  },
  nameInput: {
    flex: 1,
    padding: '0.875rem 1rem',
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '12px',
    color: '#f8fafc',
    fontSize: '1rem',
    outline: 'none',
  },
  nameInputAvatar: {
    width: '36px',
    height: '36px',
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #22d3ee 0%, #0891b2 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '1rem',
    fontWeight: '600',
    color: '#0f172a',
    flexShrink: 0,
  },
  
  logoMark: {
    fontSize: '4rem',
    fontWeight: '800',
    color: '#22d3ee',
    marginBottom: '0.5rem',
    textShadow: '0 0 40px rgba(34, 211, 238, 0.5)',
  },
  logoText: {
    fontSize: '2rem',
    fontWeight: '700',
    letterSpacing: '0.3em',
    margin: '0',
    background: 'linear-gradient(135deg, #f8fafc 0%, #94a3b8 100%)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
  },
  
  // Main app styles
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '1rem 1.5rem',
    borderBottom: '1px solid rgba(255,255,255,0.05)',
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
  },
  logoSmall: {
    fontSize: '1.5rem',
    fontWeight: '800',
    color: '#22d3ee',
  },
  userName: {
    fontWeight: '600',
    fontSize: '1rem',
  },
  userStatus: {
    fontSize: '0.75rem',
    color: '#64748b',
  },
  headerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
  },
  clock: {
    fontSize: '0.875rem',
    color: '#64748b',
    fontVariantNumeric: 'tabular-nums',
  },
  resetButton: {
    padding: '0.5rem 1rem',
    background: 'transparent',
    border: '1px solid rgba(239, 68, 68, 0.3)',
    borderRadius: '8px',
    color: '#ef4444',
    fontSize: '0.75rem',
    cursor: 'pointer',
  },
  
  upBanner: {
    background: 'linear-gradient(135deg, #22d3ee 0%, #0891b2 100%)',
    padding: '1rem',
    textAlign: 'center',
  },
  upBannerContent: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '1rem',
  },
  upBannerIcon: {
    fontSize: '1.25rem',
  },
  upBannerText: {
    fontSize: '1.25rem',
    fontWeight: '800',
    letterSpacing: '0.2em',
    color: '#0f172a',
  },
  
  nav: {
    display: 'flex',
    gap: '0.25rem',
    padding: '1rem 1.5rem',
    marginBottom: '0',
  },
  navButton: {
    flex: 1,
    padding: '0.75rem',
    background: 'transparent',
    border: 'none',
    borderBottom: '2px solid transparent',
    color: '#64748b',
    fontSize: '0.875rem',
    fontWeight: '500',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  navButtonActive: {
    color: '#22d3ee',
    borderBottomColor: '#22d3ee',
  },
  
  content: {
    padding: '0 1.5rem',
  },
  
  // Home tab styles
  homeContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
  },
  homeHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: '0.5rem',
  },
  homeTitle: {
    fontSize: '1.25rem',
    fontWeight: '600',
  },
  homeCount: {
    fontSize: '0.875rem',
    color: '#64748b',
  },
  homeGrid: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
  },
  homeCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
    padding: '1rem',
    background: 'rgba(255,255,255,0.02)',
    borderRadius: '14px',
    border: '1px solid rgba(255,255,255,0.05)',
  },
  homeCardCheckedIn: {
    background: 'rgba(34, 197, 94, 0.08)',
    borderColor: 'rgba(34, 197, 94, 0.2)',
  },
  homeCardUp: {
    background: 'rgba(34, 211, 238, 0.1)',
    borderColor: 'rgba(34, 211, 238, 0.25)',
  },
  homeCardBusy: {
    background: 'rgba(139, 92, 246, 0.1)',
    borderColor: 'rgba(139, 92, 246, 0.25)',
  },
  homeCardAway: {
    opacity: 0.6,
  },
  homeAvatar: {
    width: '48px',
    height: '48px',
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #334155 0%, #1e293b 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '1.25rem',
    fontWeight: '600',
    color: '#64748b',
    flexShrink: 0,
  },
  homeAvatarCheckedIn: {
    background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
    color: '#fff',
  },
  homeAvatarUp: {
    background: 'linear-gradient(135deg, #22d3ee 0%, #0891b2 100%)',
    color: '#0f172a',
  },
  homeAvatarBusy: {
    background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
    color: '#fff',
  },
  homeAvatarAway: {
    background: 'rgba(255,255,255,0.05)',
    color: '#64748b',
  },
  homeCardInfo: {
    flex: 1,
  },
  homeCardName: {
    fontWeight: '500',
  },
  homeCardStatus: {
    fontSize: '0.8125rem',
    marginTop: '0.25rem',
  },
  homeCardActions: {
    flexShrink: 0,
    display: 'flex',
    gap: '0.5rem',
    alignItems: 'center',
  },
  checkInButton: {
    padding: '0.5rem 1rem',
    background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
    border: 'none',
    borderRadius: '8px',
    color: '#fff',
    fontSize: '0.8125rem',
    fontWeight: '600',
    cursor: 'pointer',
  },
  checkOutButton: {
    padding: '0.5rem 1rem',
    background: 'rgba(239, 68, 68, 0.1)',
    border: '1px solid rgba(239, 68, 68, 0.3)',
    borderRadius: '8px',
    color: '#ef4444',
    fontSize: '0.8125rem',
    fontWeight: '600',
    cursor: 'pointer',
  },
  removeRepButton: {
    width: '32px',
    height: '32px',
    padding: 0,
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '8px',
    color: '#64748b',
    fontSize: '0.875rem',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearDaySection: {
    marginTop: '2rem',
    paddingTop: '1.5rem',
    borderTop: '1px solid rgba(255,255,255,0.05)',
    textAlign: 'center',
  },
  clearDayButton: {
    padding: '0.75rem 1.5rem',
    background: 'rgba(239, 68, 68, 0.1)',
    border: '1px solid rgba(239, 68, 68, 0.3)',
    borderRadius: '10px',
    color: '#ef4444',
    fontSize: '0.875rem',
    fontWeight: '600',
    cursor: 'pointer',
  },
  clearDayHint: {
    fontSize: '0.75rem',
    color: '#64748b',
    marginTop: '0.5rem',
  },
  statusUp: {
    color: '#22d3ee',
    fontWeight: '600',
  },
  statusBusy: {
    color: '#8b5cf6',
    fontWeight: '600',
  },
  statusAway: {
    color: '#f59e0b',
  },
  statusQueue: {
    color: '#22c55e',
  },
  statusNotIn: {
    color: '#64748b',
  },
  addRepSectionInline: {
    marginTop: '1rem',
  },
  addRepButton: {
    width: '100%',
    padding: '1rem',
    background: 'transparent',
    border: '2px dashed rgba(255,255,255,0.1)',
    borderRadius: '12px',
    color: '#64748b',
    fontSize: '0.875rem',
    cursor: 'pointer',
  },
  addRepForm: {
    display: 'flex',
    gap: '0.5rem',
  },
  addRepInput: {
    flex: 1,
    padding: '0.875rem 1rem',
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '12px',
    color: '#f8fafc',
    fontSize: '1rem',
    outline: 'none',
  },
  addRepSubmit: {
    padding: '0 1.25rem',
    background: 'linear-gradient(135deg, #22d3ee 0%, #0891b2 100%)',
    border: 'none',
    borderRadius: '12px',
    color: '#0f172a',
    fontWeight: '600',
    cursor: 'pointer',
  },
  addRepCancel: {
    padding: '0 1rem',
    background: 'rgba(255,255,255,0.05)',
    border: 'none',
    borderRadius: '12px',
    color: '#64748b',
    cursor: 'pointer',
  },
  
  // Queue styles
  queueContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
  },
  queueList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
  },
  queueSectionTitle: {
    fontSize: '0.75rem',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
    marginBottom: '0.5rem',
  },
  queueItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
    padding: '1rem',
    background: 'rgba(255,255,255,0.02)',
    borderRadius: '12px',
    border: '1px solid rgba(255,255,255,0.05)',
  },
  queueItemUp: {
    background: 'rgba(34, 211, 238, 0.1)',
    borderColor: 'rgba(34, 211, 238, 0.2)',
  },
  queuePosition: {
    width: '28px',
    height: '28px',
    borderRadius: '50%',
    background: 'rgba(255,255,255,0.05)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '0.875rem',
    fontWeight: '600',
    color: '#64748b',
    flexShrink: 0,
  },
  queueAvatar: {
    width: '44px',
    height: '44px',
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #334155 0%, #1e293b 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '1.25rem',
    fontWeight: '600',
    color: '#94a3b8',
    flexShrink: 0,
  },
  queueAvatarUp: {
    background: 'linear-gradient(135deg, #22d3ee 0%, #0891b2 100%)',
    color: '#0f172a',
  },
  queueInfo: {
    flex: 1,
  },
  queueName: {
    fontWeight: '500',
  },
  queueUpLabel: {
    fontSize: '0.75rem',
    color: '#22d3ee',
    fontWeight: '600',
    marginTop: '0.125rem',
  },
  queueActions: {
    display: 'flex',
    gap: '0.5rem',
    flexShrink: 0,
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
  },
  tookCustomerButton: {
    padding: '0.5rem 0.875rem',
    background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
    border: 'none',
    borderRadius: '8px',
    color: '#fff',
    fontSize: '0.75rem',
    fontWeight: '600',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  withCustomerButton: {
    padding: '0.5rem 0.875rem',
    background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
    border: 'none',
    borderRadius: '8px',
    color: '#fff',
    fontSize: '0.75rem',
    fontWeight: '600',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  stepAwayButton: {
    padding: '0.5rem 0.875rem',
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '8px',
    color: '#94a3b8',
    fontSize: '0.75rem',
    fontWeight: '500',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  
  // With Customer section
  withCustomerSection: {
    marginBottom: '1rem',
    padding: '1rem',
    background: 'rgba(139, 92, 246, 0.1)',
    borderRadius: '12px',
    border: '1px solid rgba(139, 92, 246, 0.2)',
  },
  withCustomerTitle: {
    fontSize: '0.75rem',
    color: '#8b5cf6',
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
    marginBottom: '0.75rem',
    fontWeight: '600',
  },
  withCustomerItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    padding: '0.5rem 0',
  },
  withCustomerAvatar: {
    width: '36px',
    height: '36px',
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '1rem',
    fontWeight: '600',
    color: '#fff',
  },
  withCustomerName: {
    flex: 1,
    fontWeight: '500',
    color: '#e2e8f0',
  },
  finishedButton: {
    padding: '0.5rem 1rem',
    background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
    border: 'none',
    borderRadius: '8px',
    color: '#fff',
    fontSize: '0.75rem',
    fontWeight: '600',
    cursor: 'pointer',
  },
  
  // Away section
  awaySection: {
    marginTop: '1.5rem',
    paddingTop: '1.5rem',
    borderTop: '1px solid rgba(255,255,255,0.05)',
  },
  awaySectionTitle: {
    fontSize: '0.75rem',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
    marginBottom: '0.75rem',
  },
  awayItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    padding: '0.75rem',
    opacity: 0.7,
  },
  awayAvatar: {
    width: '36px',
    height: '36px',
    borderRadius: '50%',
    background: 'rgba(255,255,255,0.05)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '1rem',
    color: '#64748b',
  },
  awayName: {
    flex: 1,
    color: '#94a3b8',
  },
  returnButtonSmall: {
    padding: '0.375rem 0.75rem',
    background: 'rgba(34, 197, 94, 0.1)',
    border: '1px solid rgba(34, 197, 94, 0.3)',
    borderRadius: '6px',
    color: '#22c55e',
    fontSize: '0.75rem',
    fontWeight: '500',
    cursor: 'pointer',
  },
  
  emptyState: {
    textAlign: 'center',
    padding: '3rem',
    color: '#64748b',
  },
  emptyIcon: {
    fontSize: '2.5rem',
    marginBottom: '1rem',
    opacity: 0.5,
  },
  emptyHint: {
    fontSize: '0.875rem',
    color: '#475569',
    marginTop: '0.25rem',
  },
  
  // Stats styles
  statsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
  },
  statsHeader: {
    fontSize: '0.75rem',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
    marginBottom: '0.5rem',
  },
  statsItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    padding: '1rem',
    background: 'rgba(255,255,255,0.02)',
    borderRadius: '12px',
    border: '1px solid rgba(255,255,255,0.05)',
  },
  statsRank: {
    width: '32px',
    textAlign: 'center',
    fontSize: '1rem',
  },
  statsAvatar: {
    width: '40px',
    height: '40px',
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #334155 0%, #1e293b 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '1rem',
    fontWeight: '600',
    color: '#94a3b8',
  },
  statsInfo: {
    flex: 1,
  },
  statsName: {
    fontWeight: '500',
    fontSize: '0.9375rem',
  },
  statsStatus: {
    fontSize: '0.75rem',
    color: '#64748b',
  },
  statsCount: {
    textAlign: 'right',
  },
  statsNumber: {
    fontSize: '1.5rem',
    fontWeight: '700',
    color: '#22d3ee',
  },
  statsLabel: {
    fontSize: '0.625rem',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  
  // History styles
  historyList: {
    display: 'flex',
    flexDirection: 'column',
  },
  historyItem: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '1rem',
    padding: '0.75rem 0',
    borderBottom: '1px solid rgba(255,255,255,0.03)',
  },
  historyTime: {
    fontSize: '0.75rem',
    color: '#64748b',
    width: '65px',
    flexShrink: 0,
    fontVariantNumeric: 'tabular-nums',
  },
  historyDot: {
    position: 'relative',
    width: '12px',
    height: '20px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  historyDotInner: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
  },
  historyContent: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '0.125rem',
  },
  historyName: {
    fontWeight: '500',
    fontSize: '0.875rem',
  },
  historyAction: {
    fontSize: '0.75rem',
    color: '#64748b',
  },
};
