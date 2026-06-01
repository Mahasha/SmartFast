/**
 * AddMealSheet — bottom-sheet form for logging a meal (name, calories, optional
 * photo). The photo is optional ("skip the photo" is just leaving it empty).
 *
 * The free-tier visual-journal limit is checked the moment the user taps a
 * photo source: if they're over the daily cap, `onPhotoBlocked` fires (the
 * parent shows the upgrade sheet) and the camera/library never opens. The
 * domain layer re-checks on save as a backstop.
 */

import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { useTheme } from '../theme/ThemeContext';
import { SubscriptionTier } from '../models/index';
import { AddMealInput, canAddMealPhoto } from '../domain/mealJournal';
import { pickMealPhoto, MealPhotoSource } from '../data/imagePicker';

interface AddMealSheetProps {
  visible: boolean;
  tier: SubscriptionTier;
  localDate: string;
  onClose: () => void;
  onSave: (input: AddMealInput) => Promise<void> | void;
  /** Called when a photo is attempted past the free-tier daily limit. */
  onPhotoBlocked: () => void;
}

export function AddMealSheet({
  visible,
  tier,
  localDate,
  onClose,
  onSave,
  onPhotoBlocked,
}: AddMealSheetProps) {
  const { theme } = useTheme();
  const [name, setName] = useState('');
  const [calories, setCalories] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Reset to a fresh form each time the sheet opens (handled via Modal.onShow).
  const resetForm = () => {
    setName('');
    setCalories('');
    setPhotoUri(null);
    setBusy(false);
  };

  const handlePickPhoto = async (source: MealPhotoSource) => {
    // Enforce the free-tier limit before opening the camera/library.
    const gate = await canAddMealPhoto(localDate, tier);
    if (!gate.allowed) {
      onPhotoBlocked();
      return;
    }

    const result = await pickMealPhoto(source);
    if (result.status === 'denied') {
      Alert.alert(
        'Permission needed',
        `Enable ${source === 'camera' ? 'camera' : 'photo library'} access to attach a meal photo.`,
      );
      return;
    }
    if (result.status === 'ok') {
      setPhotoUri(result.uri);
    }
  };

  const handleSave = async () => {
    if (name.trim().length === 0) {
      Alert.alert('Meal name required', 'Please enter a name for this meal.');
      return;
    }
    const caloriesValue = calories.trim() === '' ? null : Number(calories);
    setBusy(true);
    try {
      await onSave({ name: name.trim(), calories: caloriesValue, photoSourceUri: photoUri });
    } finally {
      setBusy(false);
    }
  };

  const inputStyle = [
    styles.input,
    {
      color: theme.colors.text,
      backgroundColor: theme.colors.background,
      borderColor: theme.colors.border,
    },
  ];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      onShow={resetForm}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <View style={styles.backdrop}>
          <TouchableOpacity
            style={styles.backdropTouch}
            activeOpacity={1}
            onPress={onClose}
            accessibilityLabel="Dismiss"
          />
          <View
            style={[
              styles.sheet,
              { backgroundColor: theme.colors.surface, borderTopColor: theme.colors.border },
            ]}
          >
            <View style={[styles.grabber, { backgroundColor: theme.colors.border }]} />
            <Text style={[styles.title, { color: theme.colors.text }]}>Add Meal</Text>

            <ScrollView keyboardShouldPersistTaps="handled" style={styles.form}>
              <Text style={[styles.label, { color: theme.colors.textSecondary }]}>Meal name</Text>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="e.g. Grilled chicken salad"
                placeholderTextColor={theme.colors.textSecondary}
                style={inputStyle}
                accessibilityLabel="Meal name"
                returnKeyType="next"
              />

              <Text style={[styles.label, { color: theme.colors.textSecondary }]}>
                Calories (optional)
              </Text>
              <TextInput
                value={calories}
                onChangeText={setCalories}
                placeholder="kcal"
                placeholderTextColor={theme.colors.textSecondary}
                keyboardType="numeric"
                style={inputStyle}
                accessibilityLabel="Calories"
              />

              <Text style={[styles.label, { color: theme.colors.textSecondary }]}>
                Photo (optional)
              </Text>
              {photoUri ? (
                <View style={styles.photoPreviewWrap}>
                  <Image
                    source={{ uri: photoUri }}
                    style={styles.photoPreview}
                    accessibilityLabel="Selected meal photo"
                  />
                  <TouchableOpacity
                    style={styles.removePhoto}
                    onPress={() => setPhotoUri(null)}
                    accessibilityRole="button"
                    accessibilityLabel="Remove photo"
                  >
                    <Text style={[styles.removePhotoText, { color: theme.colors.error }]}>
                      Remove photo
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.photoButtons}>
                  <TouchableOpacity
                    style={[styles.photoButton, { borderColor: theme.colors.border }]}
                    onPress={() => handlePickPhoto('camera')}
                    accessibilityRole="button"
                    accessibilityLabel="Take photo"
                  >
                    <Text style={[styles.photoButtonText, { color: theme.colors.text }]}>
                      📷  Take Photo
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.photoButton, { borderColor: theme.colors.border }]}
                    onPress={() => handlePickPhoto('library')}
                    accessibilityRole="button"
                    accessibilityLabel="Choose from library"
                  >
                    <Text style={[styles.photoButtonText, { color: theme.colors.text }]}>
                      🖼️  Choose
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </ScrollView>

            <TouchableOpacity
              style={[
                styles.saveButton,
                { backgroundColor: theme.colors.primary },
                busy && styles.saveButtonDisabled,
              ]}
              onPress={handleSave}
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel="Save meal"
            >
              {busy ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.saveButtonText}>Save Meal</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Cancel"
            >
              <Text style={[styles.cancelButtonText, { color: theme.colors.textSecondary }]}>
                Cancel
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  backdropTouch: {
    ...StyleSheet.absoluteFillObject,
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 24,
    maxHeight: '88%',
  },
  grabber: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 12,
  },
  form: {
    flexGrow: 0,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.4,
    marginTop: 12,
    marginBottom: 6,
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  photoButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  photoButton: {
    flex: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  photoButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  photoPreviewWrap: {
    alignItems: 'center',
  },
  photoPreview: {
    width: '100%',
    height: 180,
    borderRadius: 12,
  },
  removePhoto: {
    paddingVertical: 10,
  },
  removePhotoText: {
    fontSize: 14,
    fontWeight: '600',
  },
  saveButton: {
    marginTop: 16,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  cancelButton: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 15,
    fontWeight: '500',
  },
});
