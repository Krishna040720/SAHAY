/**
 * SAHAY Data Repository
 * ---------------------
 * In-memory repository with comprehensive seed disaster management data.
 * Ready to integrate seamlessly with MongoDB or PostgreSQL / SQLite.
 */

import { calculateTrustScore, findMatchesForMissingPerson, compareMissingWithSurvivor } from '../engine/matching.js';
import { analyzeCampResources } from '../engine/allocation.js';

export class Repository {
  constructor() {
    this.camps = new Map();
    this.missingReports = new Map();
    this.survivors = new Map();
    this.matches = new Map();
    this.activities = [];
    this.transfers = [];

    this.seedInitialData();
  }

  seedInitialData() {
    // 1. Seed Relief Camps across flood / disaster affected districts
    const seedCamps = [
      {
        id: 'CAMP-101',
        name: 'Dhubri High School Relief Camp',
        district: 'Dhubri',
        address: 'Ward 4, Near Circuit House, Dhubri, Assam',
        latitude: 26.0207,
        longitude: 89.9744,
        capacity: 400,
        occupancy: 468, // Seeded over-capacity for live ops monitoring
        verificationStatus: 'VERIFIED',
        powerStatus: 'Generator Active',
        contactName: 'Anil Roy (Camp Lead)',
        contactPhone: '+91-98640-11223',
        adminPin: '9999',
        volunteerPin: '1234',
        adminRole: 'Camp Lead / NDRF Sector 1',
        resources: { water: 25, food: 35, medical: 20, blankets: 50 }, // Critical shortages
        amenities: ['Medical Desk', 'Child Care', 'Food Hall', 'Sanitation Blocks'],
        createdAt: new Date(Date.now() - 36 * 3600000).toISOString()
      },
      {
        id: 'CAMP-102',
        name: 'Guwahati Sports Complex Shelter',
        district: 'Kamrup Metro',
        address: 'Sarusajai Stadium Campus, Guwahati, Assam',
        latitude: 26.1158,
        longitude: 91.7582,
        capacity: 1200,
        occupancy: 780,
        verificationStatus: 'VERIFIED',
        powerStatus: 'Grid Normal',
        contactName: 'Dr. Meera Borah',
        contactPhone: '+91-94350-55667',
        adminPin: '9999',
        volunteerPin: '1234',
        adminRole: 'Medical Coordinator / SDMA',
        resources: { water: 85, food: 90, medical: 75, blankets: 80 }, // Surplus resources
        amenities: ['24/7 Mobile ICU', 'Clean Water Plant', 'Community Kitchen', 'Helipad'],
        createdAt: new Date(Date.now() - 48 * 3600000).toISOString()
      },
      {
        id: 'CAMP-103',
        name: 'Silchar Town Hall Emergency Hub',
        district: 'Cachar',
        address: 'Park Road, Silchar, Assam',
        latitude: 24.8333,
        longitude: 92.7789,
        capacity: 650,
        occupancy: 590,
        verificationStatus: 'VERIFIED',
        powerStatus: 'Solar + Battery Backup',
        contactName: 'Debabrata Nath',
        contactPhone: '+91-97060-88990',
        adminPin: '9999',
        volunteerPin: '1234',
        adminRole: 'District Disaster Officer',
        resources: { water: 60, food: 55, medical: 40, blankets: 30 },
        amenities: ['Emergency First Aid', 'Welfare Desk', 'Charging Stations'],
        createdAt: new Date(Date.now() - 24 * 3600000).toISOString()
      },
      {
        id: 'CAMP-104',
        name: 'Barpeta College Indoor Stadium Camp',
        district: 'Barpeta',
        address: 'College Road, Shanti Nagar, Barpeta, Assam',
        latitude: 26.3216,
        longitude: 91.0048,
        capacity: 500,
        occupancy: 485,
        verificationStatus: 'VERIFIED',
        powerStatus: 'Generator Active',
        contactName: 'Kabir Ahmed',
        contactPhone: '+91-98540-33445',
        adminPin: '9999',
        volunteerPin: '1234',
        adminRole: 'Local Relief Commander',
        resources: { water: 30, food: 25, medical: 45, blankets: 65 },
        amenities: ['Water Filtration', 'Community Kitchen'],
        createdAt: new Date(Date.now() - 18 * 3600000).toISOString()
      },
      {
        id: 'CAMP-105',
        name: 'Tezpur Community Center Relief Shelter',
        district: 'Sonitpur',
        address: 'Mission Chariali, Tezpur, Assam',
        latitude: 26.6338,
        longitude: 92.7926,
        capacity: 700,
        occupancy: 310,
        verificationStatus: 'VERIFIED',
        powerStatus: 'Grid Normal',
        contactName: 'Nandita Kalita',
        contactPhone: '+91-94351-77889',
        adminPin: '9999',
        volunteerPin: '1234',
        adminRole: 'Shelter Manager / Red Cross',
        resources: { water: 90, food: 85, medical: 80, blankets: 90 }, // Surplus resources
        amenities: ['Supply Warehouse', 'Women Safe Space', 'Medical Dispensary'],
        createdAt: new Date(Date.now() - 30 * 3600000).toISOString()
      }
    ];

    for (const camp of seedCamps) {
      this.camps.set(camp.id, camp);
    }

    // 2. Seed Sheltered Survivors currently registered at camps
    const seedSurvivors = [
      {
        id: 'SURV-001',
        campId: 'CAMP-101',
        name: 'Rajesh Sharma',
        age: 36,
        gender: 'Male',
        photoUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
        physicalCondition: 'Minor leg scrapes, stable and receiving care',
        checkinTime: new Date(Date.now() - 14 * 3600000).toISOString(),
        originVillage: 'Bilasipara East Ward 2',
        medicalNeeds: 'None',
        notes: 'Rescued by NDRF boat from flooded village'
      },
      {
        id: 'SURV-002',
        campId: 'CAMP-102',
        name: 'Puja Devi',
        age: 28,
        gender: 'Female',
        photoUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&auto=format&fit=crop&q=80',
        physicalCondition: 'Healthy, staying with infant child',
        checkinTime: new Date(Date.now() - 20 * 3600000).toISOString(),
        originVillage: 'Palashbari riverside',
        medicalNeeds: 'Pediatric vitamins requested',
        notes: 'Looking for husband and brother'
      },
      {
        id: 'SURV-003',
        campId: 'CAMP-103',
        name: 'Sunil Mondol',
        age: 44,
        gender: 'Male',
        photoUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
        physicalCondition: 'Mild fever, treated at camp medical desk',
        checkinTime: new Date(Date.now() - 8 * 3600000).toISOString(),
        originVillage: 'Udharbond Sector 3',
        medicalNeeds: 'Paracetamol & hydration',
        notes: 'Separated during emergency bus evacuation'
      },
      {
        id: 'SURV-004',
        campId: 'CAMP-104',
        name: 'Alka Das',
        age: 19,
        gender: 'Female',
        photoUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
        physicalCondition: 'Safe and unharmed',
        checkinTime: new Date(Date.now() - 10 * 3600000).toISOString(),
        originVillage: 'Howly Bazar',
        medicalNeeds: 'None',
        notes: 'Registered by youth volunteer squad'
      },
      {
        id: 'SURV-005',
        campId: 'CAMP-105',
        name: 'Bikramjit Gogoi',
        age: 52,
        gender: 'Male',
        photoUrl: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&auto=format&fit=crop&q=80',
        physicalCondition: 'Diabetic, insulin provided by camp doctor',
        checkinTime: new Date(Date.now() - 5 * 3600000).toISOString(),
        originVillage: 'Jamugurihat',
        medicalNeeds: 'Daily insulin maintenance',
        notes: 'Arrived via state transport relief shuttle'
      }
    ];

    for (const surv of seedSurvivors) {
      this.survivors.set(surv.id, surv);
    }

    // 3. Seed Missing Person Reports (lodged by worried families & field volunteers)
    const seedMissing = [
      {
        id: 'MIS-1001',
        name: 'Rajesh Kumar Sharma',
        age: 35,
        gender: 'Male',
        photoUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
        lastSeenLocation: 'Bilasipara River Bank, Dhubri',
        lastSeenLat: 26.0400,
        lastSeenLng: 89.9900,
        status: 'POTENTIAL_MATCH',
        sourceType: 'FAMILY_MEMBER',
        reporterName: 'Suman Sharma (Spouse)',
        reporterContact: '+91-98765-43210',
        medicalUrgency: 'LOW',
        notes: 'Wearing blue check shirt and dark trousers. Left during sudden flash water rise.',
        hasPhoto: true,
        witnessCorroborations: 2,
        createdAt: new Date(Date.now() - 28 * 3600000).toISOString()
      },
      {
        id: 'MIS-1002',
        name: 'Pooja Devi',
        age: 28,
        gender: 'Female',
        photoUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&auto=format&fit=crop&q=80',
        lastSeenLocation: 'Palashbari Ferry Ghat, Kamrup',
        lastSeenLat: 26.1200,
        lastSeenLng: 91.7400,
        status: 'POTENTIAL_MATCH',
        sourceType: 'FAMILY_MEMBER',
        reporterName: 'Rameshwar Roy (Brother)',
        reporterContact: '+91-91234-56789',
        medicalUrgency: 'MEDIUM',
        notes: 'Carrying green diaper bag and infant. Phone lost during evacuation.',
        hasPhoto: true,
        witnessCorroborations: 1,
        createdAt: new Date(Date.now() - 22 * 3600000).toISOString()
      },
      {
        id: 'MIS-1003',
        name: 'Sunil Mondal',
        age: 45,
        gender: 'Male',
        photoUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
        lastSeenLocation: 'Udharbond Bus Stand, Cachar',
        lastSeenLat: 24.8400,
        lastSeenLng: 92.7900,
        status: 'POTENTIAL_MATCH',
        sourceType: 'COMMUNITY_VOLUNTEER',
        reporterName: 'Red Cross Volunteer Unit 4',
        reporterContact: '+91-99887-76655',
        medicalUrgency: 'HIGH',
        notes: 'Reported with high fever before bus departure.',
        hasPhoto: true,
        witnessCorroborations: 3,
        createdAt: new Date(Date.now() - 16 * 3600000).toISOString()
      },
      {
        id: 'MIS-1004',
        name: 'Manoj Bora',
        age: 22,
        gender: 'Male',
        photoUrl: '',
        lastSeenLocation: 'Kaziranga Southern Ridge',
        lastSeenLat: 26.5800,
        lastSeenLng: 93.1700,
        status: 'MISSING',
        sourceType: 'COMMUNITY_VOLUNTEER',
        reporterName: 'Forest Relief Post',
        reporterContact: '+91-94000-11122',
        medicalUrgency: 'MEDIUM',
        notes: 'Last seen helping cattle relocation team.',
        hasPhoto: false,
        witnessCorroborations: 0,
        createdAt: new Date(Date.now() - 6 * 3600000).toISOString()
      }
    ];

    for (const item of seedMissing) {
      item.trustScore = calculateTrustScore(item);
      this.missingReports.set(item.id, item);
    }

    // 4. Run automated matching pipeline on initial seed
    this.recomputeAllMatches();

    // 5. Seed Activity Logs
    this.activities = [
      {
        id: 'ACT-1',
        timestamp: new Date(Date.now() - 30 * 60000).toISOString(),
        type: 'MATCH_CANDIDATE',
        title: 'High Confidence Match Discovered',
        detail: 'AI matched Missing Report MIS-1001 (Rajesh Kumar Sharma) with Dhubri Camp Survivor (Rajesh Sharma) - 93% match.',
        channel: 'LIVE_WEB'
      },
      {
        id: 'ACT-2',
        timestamp: new Date(Date.now() - 45 * 60000).toISOString(),
        type: 'CAMP_OVERCAPACITY',
        title: 'Over-Capacity Alert at Dhubri High School',
        detail: 'Occupancy reached 468/400 (117%). Recommended diversion to Tezpur or nearby transit points.',
        channel: 'RADIO_MESH'
      },
      {
        id: 'ACT-3',
        timestamp: new Date(Date.now() - 90 * 60000).toISOString(),
        type: 'SMS_REPORT',
        title: 'Offline SMS Report Ingested',
        detail: 'Processed 8 crowdsourced survivor status packets via emergency SMS gateway.',
        channel: 'SMS_FALLBACK'
      }
    ];
  }

  // --- Camp Operations ---
  getAllCamps() {
    return Array.from(this.camps.values());
  }

  getCampById(id) {
    return this.camps.get(id) || null;
  }

  createCamp(campData) {
    const id = `CAMP-${Date.now().toString().slice(-4)}`;
    const newCamp = {
      id,
      name: campData.name.trim(),
      district: campData.district.trim(),
      address: campData.address || `${campData.district} Relief Center`,
      latitude: Number(campData.latitude) || 26.1445,
      longitude: Number(campData.longitude) || 91.7362,
      capacity: Number(campData.capacity),
      occupancy: Number(campData.occupancy || 0),
      verificationStatus: campData.verificationStatus || 'VERIFIED',
      powerStatus: campData.powerStatus || 'Generator Active',
      contactName: campData.contactName || 'Relief Officer',
      contactPhone: campData.contactPhone || '+91-1800-SAHAY',
      adminPin: (campData.adminPin || '9999').toString().trim(),
      volunteerPin: (campData.volunteerPin || '1234').toString().trim(),
      adminRole: campData.adminRole || 'Camp Lead',
      resources: {
        water: Number(campData.water ?? 70),
        food: Number(campData.food ?? 70),
        medical: Number(campData.medical ?? 70),
        blankets: Number(campData.blankets ?? 70)
      },
      amenities: campData.amenities || ['Medical First Aid', 'Clean Water', 'Community Kitchen'],
      createdAt: new Date().toISOString()
    };

    this.camps.set(id, newCamp);
    this.logActivity('CAMP_REGISTERED', `New relief camp registered: ${newCamp.name}`, `Capacity: ${newCamp.capacity}, District: ${newCamp.district}`, 'LIVE_WEB');
    return newCamp;
  }

  updateCamp(id, updates) {
    const camp = this.camps.get(id);
    if (!camp) return null;

    if (updates.occupancy !== undefined && updates.occupancy !== null) camp.occupancy = Math.max(0, Number(updates.occupancy));
    if (updates.capacity !== undefined && updates.capacity !== null) camp.capacity = Math.max(1, Number(updates.capacity));
    if (updates.powerStatus) camp.powerStatus = String(updates.powerStatus);
    if (updates.contactName) camp.contactName = String(updates.contactName);
    if (updates.contactPhone) camp.contactPhone = String(updates.contactPhone);

    if (!camp.resources) {
      camp.resources = { water: 50, food: 50, medical: 50, blankets: 50 };
    }

    if (updates.resources && typeof updates.resources === 'object') {
      if (updates.resources.water !== undefined) camp.resources.water = Math.max(0, Math.min(100, Number(updates.resources.water)));
      if (updates.resources.food !== undefined) camp.resources.food = Math.max(0, Math.min(100, Number(updates.resources.food)));
      if (updates.resources.medical !== undefined) camp.resources.medical = Math.max(0, Math.min(100, Number(updates.resources.medical)));
      if (updates.resources.blankets !== undefined) camp.resources.blankets = Math.max(0, Math.min(100, Number(updates.resources.blankets)));
    }

    if (updates.water !== undefined) camp.resources.water = Math.max(0, Math.min(100, Number(updates.water)));
    if (updates.food !== undefined) camp.resources.food = Math.max(0, Math.min(100, Number(updates.food)));
    if (updates.medical !== undefined) camp.resources.medical = Math.max(0, Math.min(100, Number(updates.medical)));
    if (updates.blankets !== undefined) camp.resources.blankets = Math.max(0, Math.min(100, Number(updates.blankets)));

    this.logActivity('CAMP_UPDATED', `Camp Sitrep updated: ${camp.name}`, `Occupancy: ${camp.occupancy}/${camp.capacity} beds (${Math.max(0, camp.capacity - camp.occupancy)} free), Water: ${camp.resources.water}%, Food: ${camp.resources.food}%, Med: ${camp.resources.medical}%`, 'LIVE_WEB');
    return camp;
  }

  // --- Missing Persons ---
  getAllMissing() {
    return Array.from(this.missingReports.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  getMissingById(id) {
    return this.missingReports.get(id) || null;
  }

  createMissingReport(reportData) {
    const id = `MIS-${Date.now().toString().slice(-4)}`;
    const newReport = {
      id,
      name: reportData.name.trim(),
      age: reportData.age ? Number(reportData.age) : null,
      gender: reportData.gender || 'Unknown',
      photoUrl: reportData.photoUrl || '',
      lastSeenLocation: reportData.lastSeenLocation.trim(),
      lastSeenLat: reportData.lastSeenLat ? Number(reportData.lastSeenLat) : null,
      lastSeenLng: reportData.lastSeenLng ? Number(reportData.lastSeenLng) : null,
      status: 'MISSING',
      sourceType: reportData.sourceType || 'COMMUNITY_VOLUNTEER',
      reporterName: reportData.reporterName || 'Anonymous',
      reporterContact: reportData.reporterContact || '',
      medicalUrgency: reportData.medicalUrgency || 'MEDIUM',
      notes: reportData.notes || '',
      hasPhoto: Boolean(reportData.photoUrl),
      witnessCorroborations: Number(reportData.witnessCorroborations || 0),
      createdAt: new Date().toISOString()
    };

    newReport.trustScore = calculateTrustScore(newReport);
    this.missingReports.set(id, newReport);

    // Auto-trigger matching pipeline
    const newMatches = findMatchesForMissingPerson(newReport, Array.from(this.survivors.values()), this.camps);
    if (newMatches.length > 0) {
      newReport.status = 'POTENTIAL_MATCH';
      for (const m of newMatches) {
        const matchId = `MATCH-${newReport.id}-${m.survivorId}`;
        this.matches.set(matchId, { ...m, id: matchId });
      }
      this.logActivity(
        'CRITICAL_MATCH',
        `AI matched report for ${newReport.name}`,
        `Found ${newMatches.length} candidate match(es). Top confidence: ${newMatches[0].matchScore}%`,
        'LIVE_WEB'
      );
    } else {
      this.logActivity(
        'REPORT_LOGGED',
        `Missing person report filed for ${newReport.name}`,
        `Location: ${newReport.lastSeenLocation} | Trust Score: ${newReport.trustScore}/100`,
        'LIVE_WEB'
      );
    }

    return newReport;
  }

  // --- Sheltered Survivors ---
  getAllSurvivors() {
    return Array.from(this.survivors.values()).sort(
      (a, b) => new Date(b.checkinTime).getTime() - new Date(a.checkinTime).getTime()
    );
  }

  createSurvivor(survivorData) {
    const id = `SURV-${Date.now().toString().slice(-4)}`;
    const newSurvivor = {
      id,
      campId: survivorData.campId || null,
      name: survivorData.name.trim(),
      age: survivorData.age ? Number(survivorData.age) : null,
      gender: survivorData.gender || 'Unknown',
      photoUrl: survivorData.photoUrl || '',
      physicalCondition: survivorData.physicalCondition || 'Stable',
      checkinTime: new Date().toISOString(),
      originVillage: survivorData.originVillage || 'Disaster Zone',
      medicalNeeds: survivorData.medicalNeeds || 'None',
      notes: survivorData.notes || ''
    };

    this.survivors.set(id, newSurvivor);

    // Update camp occupancy if campId provided
    if (newSurvivor.campId && this.camps.has(newSurvivor.campId)) {
      const camp = this.camps.get(newSurvivor.campId);
      camp.occupancy += 1;
    }

    // Trigger match check against all open missing reports
    const openMissing = Array.from(this.missingReports.values()).filter((r) => r.status !== 'REUNITED');
    const camp = newSurvivor.campId ? this.camps.get(newSurvivor.campId) : null;

    for (const missing of openMissing) {
      const comp = compareMissingWithSurvivor(missing, newSurvivor, camp);
      if (comp.isCandidate) {
        const matchId = `MATCH-${missing.id}-${newSurvivor.id}`;
        this.matches.set(matchId, {
          id: matchId,
          missingPersonId: missing.id,
          survivorId: newSurvivor.id,
          campId: newSurvivor.campId,
          campName: camp ? camp.name : 'Emergency Shelter',
          missingName: missing.name,
          survivorName: newSurvivor.name,
          matchScore: comp.matchScore,
          confidence: comp.confidence,
          distanceKm: comp.distanceKm,
          factors: comp.factors,
          status: 'PENDING_REVIEW',
          createdAt: new Date().toISOString()
        });
        missing.status = 'POTENTIAL_MATCH';
      }
    }

    this.logActivity('SURVIVOR_CHECKIN', `Survivor check-in recorded: ${newSurvivor.name}`, `Location: ${camp ? camp.name : 'Field Post'}`, 'LIVE_WEB');
    return newSurvivor;
  }

  // --- Matches Queue ---
  getAllMatches() {
    return Array.from(this.matches.values()).sort((a, b) => b.matchScore - a.matchScore);
  }

  resolveMatch(matchId, action, reviewerNotes = '') {
    const match = this.matches.get(matchId);
    if (!match) return null;

    match.status = action === 'CONFIRM' ? 'CONFIRMED' : 'DISMISSED';
    match.reviewerNotes = reviewerNotes;
    match.resolvedAt = new Date().toISOString();

    const missing = this.missingReports.get(match.missingPersonId);
    if (missing) {
      if (action === 'CONFIRM') {
        missing.status = 'REUNITED';
        this.logActivity(
          'REUNITED_SUCCESS',
          `Family Reunited! ${missing.name}`,
          `Confirmed at ${match.campName}. Verification alert broadcasted via SMS/Radio.`,
          'SMS_FALLBACK'
        );
      } else {
        // If dismissed and no other pending matches, set back to MISSING
        const otherMatches = Array.from(this.matches.values()).filter(
          (m) => m.missingPersonId === missing.id && m.id !== matchId && m.status === 'PENDING_REVIEW'
        );
        if (otherMatches.length === 0) missing.status = 'MISSING';
      }
    }

    return match;
  }

  recomputeAllMatches() {
    this.matches.clear();
    const missingList = Array.from(this.missingReports.values());
    const survivorsList = Array.from(this.survivors.values());

    for (const missing of missingList) {
      const results = findMatchesForMissingPerson(missing, survivorsList, this.camps);
      for (const res of results) {
        const matchId = `MATCH-${res.missingPersonId}-${res.survivorId}`;
        this.matches.set(matchId, { ...res, id: matchId });
      }
    }
  }

  // --- Resource Allocation & Logistics ---
  getResourceBalancing() {
    const camps = this.getAllCamps();
    return analyzeCampResources(camps);
  }

  // --- Statistics ---
  getDashboardStats() {
    const camps = this.getAllCamps();
    const missing = this.getAllMissing();
    const survivors = this.getAllSurvivors();
    const matches = this.getAllMatches();

    const totalCapacity = camps.reduce((sum, c) => sum + c.capacity, 0);
    const totalOccupancy = camps.reduce((sum, c) => sum + c.occupancy, 0);
    const overCapacityCamps = camps.filter((c) => c.occupancy > c.capacity).length;
    const criticalResourceCamps = camps.filter((c) =>
      Object.values(c.resources || {}).some((v) => Number(v) <= 30)
    ).length;

    const reunitedCount = missing.filter((m) => m.status === 'REUNITED').length;
    const activeMissing = missing.filter((m) => m.status === 'MISSING').length;
    const pendingMatches = matches.filter((m) => m.status === 'PENDING_REVIEW').length;

    return {
      campsCount: camps.length,
      totalCapacity,
      totalOccupancy,
      occupancyRate: totalCapacity > 0 ? Math.round((totalOccupancy / totalCapacity) * 100) : 0,
      overCapacityCamps,
      criticalResourceCamps,
      missingCount: missing.length,
      activeMissing,
      reunitedCount,
      survivorsCount: survivors.length,
      pendingMatches,
      lastSyncTime: new Date().toISOString()
    };
  }

  logActivity(type, title, detail, channel = 'LIVE_WEB') {
    const act = {
      id: `ACT-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      timestamp: new Date().toISOString(),
      type,
      title,
      detail,
      channel
    };
    this.activities.unshift(act);
    if (this.activities.length > 50) this.activities.pop();
    return act;
  }

  getActivities() {
    return this.activities;
  }
}

export const db = new Repository();
