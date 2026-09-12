import { FileText, Stethoscope } from 'lucide-react-native';
import { StyleSheet, TextInput, View } from 'react-native';
import { useAppTheme } from '../../../shared/providers/ThemeProvider';

export function PharmacyPrescriptionContext({
    doctorName,
    prescriptionReference,
    onDoctorNameChange,
    onPrescriptionReferenceChange,
}: {
    doctorName: string;
    prescriptionReference: string;
    onDoctorNameChange: (value: string) => void;
    onPrescriptionReferenceChange: (value: string) => void;
}) {
    const { themeColors: c } = useAppTheme();
    return (
        <View style={[s.wrap, { backgroundColor: c.background }]}>
            <View style={[s.field, { backgroundColor: c.surfaceMuted, borderColor: c.outlineMuted }]}>
                <Stethoscope size={15} color={c.textSecondary} />
                <TextInput
                    accessibilityLabel="Prescribing doctor name"
                    placeholder="Doctor name"
                    placeholderTextColor={c.textSecondary}
                    value={doctorName}
                    onChangeText={onDoctorNameChange}
                    style={[s.input, { color: c.text }]}
                />
            </View>
            <View style={[s.field, { backgroundColor: c.surfaceMuted, borderColor: c.outlineMuted }]}>
                <FileText size={15} color={c.textSecondary} />
                <TextInput
                    accessibilityLabel="Prescription reference"
                    autoCapitalize="characters"
                    placeholder="Prescription reference"
                    placeholderTextColor={c.textSecondary}
                    value={prescriptionReference}
                    onChangeText={onPrescriptionReferenceChange}
                    style={[s.input, { color: c.text }]}
                />
            </View>
        </View>
    );
}

const s = StyleSheet.create({
    wrap: { flexDirection: 'row', gap: 7, paddingHorizontal: 16, paddingTop: 8 },
    field: {
        flex: 1,
        minHeight: 40,
        borderWidth: 1,
        borderRadius: 11,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 10,
        gap: 7,
    },
    input: { flex: 1, minWidth: 0, fontSize: 11, fontWeight: '700', paddingVertical: 8 },
});
