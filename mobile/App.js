import React, { useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView, SafeAreaView, TextInput } from 'react-native';
import { StatusBar } from 'expo-status-bar';

export default function App() {
  const [activeTab, setActiveTab] = useState('services'); // services | chat | tracking
  const [appNumber, setAppNumber] = useState('REV-DEMO-2026-0001');

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />
      
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>🏛️ RevGOV Mobile</Text>
        <Text style={styles.headerSub}>Revenue Services Platform</Text>
      </View>

      {/* Main Content Area */}
      <ScrollView style={styles.content}>
        {activeTab === 'services' && (
          <View>
            <Text style={styles.sectionTitle}>Revenue Certificate Services</Text>
            
            <TouchableOpacity style={styles.serviceCard}>
              <Text style={styles.cardTitle}>📜 Income Certificate</Text>
              <Text style={styles.cardSub}>Malayalam & English voice-first application</Text>
              <Text style={styles.cardMeta}>Processing: 7 Days • Fee: ₹25</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.serviceCard}>
              <Text style={styles.cardTitle}>🏔️ Domicile Certificate</Text>
              <Text style={styles.cardSub}>Proof of state residence</Text>
              <Text style={styles.cardMeta}>Processing: 5 Days • Fee: ₹25</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.serviceCard}>
              <Text style={styles.cardTitle}>🤝 Caste Certificate</Text>
              <Text style={styles.cardSub}>Community category verification</Text>
              <Text style={styles.cardMeta}>Processing: 10 Days • Fee: ₹25</Text>
            </TouchableOpacity>
          </View>
        )}

        {activeTab === 'chat' && (
          <View>
            <Text style={styles.sectionTitle}>Malayalam Voice Assistant</Text>
            <View style={styles.chatBubbleAi}>
              <Text style={styles.chatText}>നമസ്കാരം! വരുമാന സർട്ടിഫിക്കറ്റ് അപേക്ഷ ആരംഭിക്കാം. (Welcome! Let us start your Income Certificate application.)</Text>
            </View>
            <View style={styles.chatBubbleUser}>
              <Text style={styles.chatText}>Rajesh Kumar Sharma</Text>
            </View>
            <TouchableOpacity style={styles.micBtn}>
              <Text style={styles.micText}>🎙️ Hold to Speak Malayalam</Text>
            </TouchableOpacity>
          </View>
        )}

        {activeTab === 'tracking' && (
          <View>
            <Text style={styles.sectionTitle}>Application Status Tracking</Text>
            <View style={styles.statusCard}>
              <Text style={styles.statusAppNo}>{appNumber}</Text>
              <Text style={styles.statusBadge}>UNDER OFFICER REVIEW</Text>
              <Text style={styles.statusStep}>Step 3 of 5: Document Verification & Discrepancy Check</Text>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Bottom Navigation */}
      <View style={styles.bottomNav}>
        <TouchableOpacity style={styles.navBtn} onPress={() => setActiveTab('services')}>
          <Text style={activeTab === 'services' ? styles.navActive : styles.navInactive}>📜 Services</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navBtn} onPress={() => setActiveTab('chat')}>
          <Text style={activeTab === 'chat' ? styles.navActive : styles.navInactive}>💬 Voice Chat</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navBtn} onPress={() => setActiveTab('tracking')}>
          <Text style={activeTab === 'tracking' ? styles.navActive : styles.navInactive}>🔍 Tracking</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: { backgroundColor: '#1e3a8a', padding: 20, paddingTop: 40 },
  headerTitle: { color: '#ffffff', fontSize: 20, fontWeight: 'bold' },
  headerSub: { color: '#93c5fd', fontSize: 12, marginTop: 2 },
  content: { flex: 1, padding: 16 },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#0f172a', marginBottom: 12 },
  serviceCard: { backgroundColor: '#ffffff', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 12 },
  cardTitle: { fontSize: 16, fontWeight: 'bold', color: '#1e3a8a' },
  cardSub: { fontSize: 12, color: '#64748b', marginTop: 4 },
  cardMeta: { fontSize: 11, color: '#15803d', fontWeight: 'bold', marginTop: 8 },
  chatBubbleAi: { backgroundColor: '#e2e8f0', padding: 12, borderRadius: 12, marginBottom: 10, alignSelf: 'flex-start' },
  chatBubbleUser: { backgroundColor: '#2563eb', padding: 12, borderRadius: 12, marginBottom: 10, alignSelf: 'flex-end' },
  chatText: { fontSize: 14, color: '#0f172a' },
  micBtn: { backgroundColor: '#16a34a', padding: 16, borderRadius: 999, alignItems: 'center', marginTop: 20 },
  micText: { color: '#ffffff', fontWeight: 'bold', fontSize: 16 },
  statusCard: { backgroundColor: '#ffffff', padding: 20, borderRadius: 12, borderWidth: 1, borderColor: '#cbd5e1' },
  statusAppNo: { fontSize: 18, fontWeight: 'bold', color: '#0f172a' },
  statusBadge: { backgroundColor: '#fef3c7', color: '#b45309', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4, fontWeight: 'bold', fontSize: 12, alignSelf: 'flex-start', marginVertical: 8 },
  statusStep: { fontSize: 12, color: '#64748b' },
  bottomNav: { flexDirection: 'row', backgroundColor: '#ffffff', borderTopWidth: 1, borderTopColor: '#e2e8f0', paddingVertical: 12 },
  navBtn: { flex: 1, alignItems: 'center' },
  navActive: { color: '#1e3a8a', fontWeight: 'bold', fontSize: 14 },
  navInactive: { color: '#64748b', fontSize: 14 },
});
